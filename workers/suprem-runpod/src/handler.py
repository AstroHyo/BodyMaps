import torch
import torch.nn.functional as F
import numpy as np
from tqdm import tqdm
import os
import nibabel as nib
import scipy.ndimage as ndimage
from monai.inferers import sliding_window_inference
from model.Universal_model import Universal_model
from dataset.dataloader_test import get_loader
from utils.utils import threshold_organ, pseudo_label_all_organ, pseudo_label_single_organ
from utils.utils import TEMPLATE, NUM_CLASS, ORGAN_NAME_LOW
from utils.utils import organ_post_process, threshold_organ, invert_transform

print("Loading model...")
num_samples = int(os.environ.get('NUM_SAMPLES', 1))

backbone = os.environ.get('BACKBONE', 'unet')
checkpoint_name = os.environ.get('CHECKPOINT', 'supervised_suprem_unet_2100')

model = Universal_model(
  img_size=(96, 96, 96),
  in_channels=1,
  out_channels=NUM_CLASS,
  backbone=backbone,
  encoding='word_embedding',
)

checkpoint = torch.load(f'./pretrained_checkpoints/{checkpoint_name}.pth')

allowed_keys = { key for key in model.state_dict().keys() }
loaded_dict = { key.removeprefix('module.'): value for key, value in checkpoint['net'].items() }

for key in loaded_dict.keys():
  if key not in allowed_keys:
    raise ValueError(f'Key {key} is not allowed in the model.')

model.load_state_dict(loaded_dict)
model.cuda()

ORGAN_NAME_TO_INDEX = {}
for organ_index in TEMPLATE['target']:
  organ_name = ORGAN_NAME_LOW[organ_index - 1]
  ORGAN_NAME_TO_INDEX[organ_name] = organ_index

SUPPORTED_TARGETS = tuple(ORGAN_NAME_TO_INDEX.keys())
DEFAULT_INFERENCE_PARAMS = {
  'space_x': 1.5,
  'space_y': 1.5,
  'space_z': 1.5,
  'a_min': -175,
  'a_max': 250,
  'b_min': 0.0,
  'b_max': 1.0,
  'roi_x': 96,
  'roi_y': 96,
  'roi_z': 96,
  'num_samples': 1,
}

DEFAULT_ALLOWED_CT_HOSTS = ('.public.blob.vercel-storage.com',)
MAX_CT_DOWNLOAD_BYTES = int(os.environ.get('MAX_CT_DOWNLOAD_BYTES', 32 * 1024 * 1024))
MAX_CT_REDIRECTS = int(os.environ.get('MAX_CT_REDIRECTS', 3))
DOWNLOAD_CONNECT_TIMEOUT_SECONDS = float(os.environ.get('DOWNLOAD_CONNECT_TIMEOUT_SECONDS', 5))
DOWNLOAD_READ_TIMEOUT_SECONDS = float(os.environ.get('DOWNLOAD_READ_TIMEOUT_SECONDS', 60))

PARAM_BOUNDS = {
  'space_x': (0.5, 5.0),
  'space_y': (0.5, 5.0),
  'space_z': (0.5, 5.0),
  'a_min': (-2048.0, 4096.0),
  'a_max': (-2048.0, 4096.0),
  'b_min': (0.0, 1.0),
  'b_max': (0.0, 1.0),
  'roi_x': (32, 192),
  'roi_y': (32, 192),
  'roi_z': (32, 192),
  'num_samples': (1, 4),
}

ORGAN_IDS_VOLUME_NA = {ORGAN_NAME_TO_INDEX[i] for i in ['aorta', 'postcava']}

def voxelThreshold(slice):
  num_voxels = len(slice[slice > 0])
  return num_voxels < 100
  
def getCalcVolumeState(img_data, organ):
  if organ in ORGAN_IDS_VOLUME_NA:
    return "NA" # blood vessel, volume is NA
  slices = [
    img_data[:, :, 0],
    img_data[:, :, -1],
    img_data[0, :, :],
    img_data[-1, :, :],
    img_data[:, 0, :],
    img_data[:, -1, :],
  ]
  for slice in slices:
    if voxelThreshold(slice) is False:
      return "incomplete"
  return "complete"

DECIMAL_PRECISION_VOLUME = 2
DECIMAL_PRECISION_HU = 1
EROSION_PIXELS = 4
cube_len = (2 * EROSION_PIXELS) + 1
STRUCTURING_ELEMENT = np.ones([cube_len, cube_len, cube_len], dtype=bool)

def processMasks(ct_fdata, seg_id, seg):
  organ_data = {}
  seg_data = seg.get_fdata()
  state = getCalcVolumeState(seg_data, seg_id)
  if state == "complete":
    volume_cm = round(float(nib.imagestats.mask_volume(seg)/1000), DECIMAL_PRECISION_VOLUME)
    organ_data['volume_cm'] = volume_cm
  elif state == "incomplete":
    organ_data['volume_cm'] = "Incomplete organ"
  elif state == "NA":
    organ_data['volume_cm'] = "N/A"
  
  erosion_data = ndimage.binary_erosion(seg_data, structure=STRUCTURING_ELEMENT)
  hu_values = ct_fdata[erosion_data > 0]
  if len(hu_values) == 0:
    organ_data['mean_hu'] = 'N/A'
  else:
    mean_hu = round(float(np.mean(hu_values)), DECIMAL_PRECISION_HU)
    organ_data['mean_hu'] = mean_hu

  return organ_data

def validation(model, ValLoader, val_transforms, args):
  organ_data = {}

  save_dir = args.save_dir
  if not os.path.isdir(save_dir):
    os.makedirs(save_dir)
  model.eval()
  dice_list = {}
  for key in TEMPLATE.keys():
    dice_list[key] = np.zeros((2, NUM_CLASS)) # 1st row for dice, 2nd row for count
  for index, batch in enumerate(tqdm(ValLoader)):
    image, name_img = batch["image"].cuda(), batch["name_img"]
    image_file_path = os.path.join(args.data_root_path, name_img[0], 'ct.nii.gz')
    case_save_path = os.path.join(save_dir, name_img[0].split('/')[0])
    print(case_save_path)
    if not os.path.isdir(case_save_path):
      os.makedirs(case_save_path)
    organ_seg_save_path = os.path.join(save_dir, name_img[0].split('/')[0], 'segmentations')
    print(image_file_path)
    print(image.shape)
    print(name_img)
    # if you want to copy ct file to the save_dir as well, uncomment the following lines
    # destination_ct = os.path.join(case_save_path, 'ct.nii.gz')
    # if not os.path.isfile(destination_ct):
    #     shutil.copy(image_file_path, destination_ct)
    #     print("Image File copied successfully.")
    ct = nib.load(image_file_path)
    ct_fdata = ct.get_fdata()
    affine_temp = ct.affine
    with torch.no_grad():
      pred = sliding_window_inference(image, (args.roi_x, args.roi_y, args.roi_z), 1, model, overlap=0.75, mode='gaussian')
      pred_sigmoid = F.sigmoid(pred)
    pred_hard = threshold_organ(pred_sigmoid, args)
    pred_hard = pred_hard.cpu()
    torch.cuda.empty_cache()

    B = pred_hard.shape[0]
    for b in range(B):
      organ_list_all = TEMPLATE['target'] # post processing target organ
      pred_hard_post, _ = organ_post_process(pred_hard.numpy(), organ_list_all, case_save_path, args)
      pred_hard_post = torch.tensor(pred_hard_post)
    
    if args.store_result:
      if not os.path.isdir(organ_seg_save_path):
        os.makedirs(organ_seg_save_path)

      # organ_index_all = TEMPLATE['target']      
      for organ_index in args.organ_indices:
        print(f'Processing organ {organ_index}')
        pseudo_label_single = pseudo_label_single_organ(pred_hard_post, organ_index, args)
        organ_name = ORGAN_NAME_LOW[organ_index-1]
        batch[organ_name]=pseudo_label_single.cpu()
        BATCH = invert_transform(organ_name, batch, val_transforms)
        organ_invertd = np.squeeze(BATCH[0][organ_name].numpy(), axis = 0)
        organ_save = nib.Nifti1Image(organ_invertd, affine_temp)
        new_name = os.path.join(organ_seg_save_path, organ_name + '.nii.gz')
        nib.save(organ_save, new_name)
        print('organ seg saved in path: %s'%(new_name))
        
        organ_data[organ_name] = processMasks(ct_fdata, organ_index, organ_save)

      if args.include_combined:
        print('Processing combined labels')
        pseudo_label_all = pseudo_label_all_organ(pred_hard_post, args)
        batch['pseudo_label'] = pseudo_label_all.cpu()
        BATCH = invert_transform('pseudo_label', batch, val_transforms)
        pseudo_label_invertd = np.squeeze(BATCH[0]['pseudo_label'].numpy(), axis = 0)
        pseudo_label_save = nib.Nifti1Image(pseudo_label_invertd, affine_temp)
        new_name = os.path.join(case_save_path, 'combined_labels.nii.gz')
        nib.save(pseudo_label_save, new_name)
        print('pseudo label saved in path: %s'%(new_name))
          
    torch.cuda.empty_cache()
  
  return organ_data

class AttrDict(dict):
  def __getattr__(self, name):
    try:
      return self[name]
    except KeyError:
      raise AttributeError(f"'AttrDict' object has no attribute '{name}'")
  
  def __setattr__(self, name, value):
    self[name] = value
  
  def __delattr__(self, name):
    try:
      del self[name]
    except KeyError:
      raise AttributeError(f"'AttrDict' object has no attribute '{name}'")

print("Model loaded.")

import runpod
import tempfile
import requests
import base64
import glob
import ipaddress
import socket
from urllib.parse import unquote, urljoin, urlparse

# If your handler runs inference on a model, load the model here.
# You will want models to be loaded into memory before starting serverless.

def require_job_input(job):
  job_input = job.get('input')
  if not isinstance(job_input, dict):
    raise ValueError('RunPod job input must be an object.')
  return job_input

def require_url(job_input):
  url = job_input.get('url')
  if not isinstance(url, str) or not url:
    raise ValueError('Missing required input.url.')
  return url

def parse_param(job_input, name, cast):
  value = job_input.get(name, DEFAULT_INFERENCE_PARAMS[name])
  try:
    return cast(value)
  except (TypeError, ValueError):
    raise ValueError(f'Invalid input.{name}: {value!r}')

def parse_bounded_param(job_input, name, cast):
  value = parse_param(job_input, name, cast)
  if not np.isfinite(value):
    raise ValueError(f'input.{name} must be finite.')
  min_value, max_value = PARAM_BOUNDS[name]
  if value < min_value or value > max_value:
    raise ValueError(f'input.{name} must be between {min_value} and {max_value}.')
  return value

def allowed_ct_host_patterns():
  configured = [
    value.strip().lower().rstrip('.')
    for value in os.environ.get('ALLOWED_CT_URL_HOSTS', '').split(',')
    if value.strip()
  ]
  return DEFAULT_ALLOWED_CT_HOSTS + tuple(configured)

def hostname_matches_pattern(hostname, pattern):
  normalized_hostname = hostname.lower().rstrip('.')
  normalized_pattern = pattern.lower().rstrip('.')
  if normalized_pattern.startswith('.'):
    return normalized_hostname.endswith(normalized_pattern)
  return normalized_hostname == normalized_pattern

def is_allowed_ct_hostname(hostname):
  return any(
    hostname_matches_pattern(hostname, pattern)
    for pattern in allowed_ct_host_patterns()
  )

def ensure_public_dns(hostname):
  try:
    addresses = socket.getaddrinfo(hostname, 443, proto=socket.IPPROTO_TCP)
  except socket.gaierror as error:
    raise ValueError(f'Could not resolve CT URL host: {hostname}') from error

  for address in addresses:
    ip = ipaddress.ip_address(address[4][0])
    if not ip.is_global:
      raise ValueError('CT URL host resolved to a non-public network address.')

def validate_download_url(url):
  parsed = urlparse(url)
  if parsed.scheme != 'https':
    raise ValueError('input.url must use HTTPS.')
  if parsed.username or parsed.password:
    raise ValueError('input.url must not include credentials.')
  if not parsed.hostname or not is_allowed_ct_hostname(parsed.hostname):
    raise ValueError('input.url host is not allowed.')
  if not unquote(parsed.path).lower().endswith('.nii.gz'):
    raise ValueError('input.url must point to a .nii.gz file.')

  ensure_public_dns(parsed.hostname)
  return url

def response_content_length(response):
  raw_length = response.headers.get('Content-Length')
  if not raw_length:
    return None
  try:
    return int(raw_length)
  except ValueError:
    return None

def fetch_ct_response(url):
  current_url = validate_download_url(url)
  for _ in range(MAX_CT_REDIRECTS + 1):
    response = requests.get(
      current_url,
      headers={
        'User-Agent': 'BodyMaps-RunPod-Worker/1.0',
      },
      stream=True,
      allow_redirects=False,
      timeout=(DOWNLOAD_CONNECT_TIMEOUT_SECONDS, DOWNLOAD_READ_TIMEOUT_SECONDS),
    )

    if response.status_code in (301, 302, 303, 307, 308):
      location = response.headers.get('Location')
      response.close()
      if not location:
        raise ValueError('CT URL redirect did not include a Location header.')
      current_url = validate_download_url(urljoin(current_url, location))
      continue

    return response

  raise ValueError('CT URL exceeded the redirect limit.')

def download_ct(url, destination_path):
  response = fetch_ct_response(url)
  if response.status_code != 200:
    raise ValueError(f'Failed to download CT: {response.status_code}')

  content_length = response_content_length(response)
  if content_length is not None and content_length > MAX_CT_DOWNLOAD_BYTES:
    response.close()
    raise ValueError('CT download exceeds the maximum allowed size.')

  bytes_written = 0
  try:
    with open(destination_path, 'wb') as f:
      for chunk in response.iter_content(chunk_size=1024 * 1024):
        if not chunk:
          continue
        bytes_written += len(chunk)
        if bytes_written > MAX_CT_DOWNLOAD_BYTES:
          raise ValueError('CT download exceeds the maximum allowed size.')
        f.write(chunk)
  finally:
    response.close()

def resolve_targets(targets):
  if not isinstance(targets, list):
    raise ValueError('input.targets must be a list.')

  organ_indices = []
  include_combined = False
  for target in targets:
    if target == 'all':
      include_combined = True
      continue
    if target not in ORGAN_NAME_TO_INDEX:
      supported = ', '.join(SUPPORTED_TARGETS)
      raise ValueError(f'Invalid target: {target}. Supported targets: {supported}')
    organ_indices.append(ORGAN_NAME_TO_INDEX[target])

  if not organ_indices and not include_combined:
    raise ValueError('No targets specified.')

  return organ_indices, include_combined

def handler(job):
  """ Handler function that will be used to process jobs. """
  job_input = require_job_input(job)
  url = require_url(job_input)

  organ_indices, include_combined = resolve_targets(job_input.get('targets', []))

  workdir = tempfile.TemporaryDirectory()

  input_dir = os.path.join(workdir.name, 'inputs')
  sample_dir = os.path.join(input_dir, 'sample')
  os.makedirs(sample_dir, exist_ok=True)

  output_dir = os.path.join(workdir.name, 'outputs')
  os.makedirs(output_dir, exist_ok=True)
  
  space_x = parse_bounded_param(job_input, 'space_x', float)
  space_y = parse_bounded_param(job_input, 'space_y', float)
  space_z = parse_bounded_param(job_input, 'space_z', float)
  
  a_min = parse_bounded_param(job_input, 'a_min', float)
  a_max = parse_bounded_param(job_input, 'a_max', float)
  b_min = parse_bounded_param(job_input, 'b_min', float)
  b_max = parse_bounded_param(job_input, 'b_max', float)
  
  roi_x = parse_bounded_param(job_input, 'roi_x', int)
  roi_y = parse_bounded_param(job_input, 'roi_y', int)
  roi_z = parse_bounded_param(job_input, 'roi_z', int)
  
  num_samples = parse_bounded_param(job_input, 'num_samples', int)

  if a_min >= a_max:
    raise ValueError('input.a_min must be smaller than input.a_max.')
  if b_min >= b_max:
    raise ValueError('input.b_min must be smaller than input.b_max.')

  parsed_url = urlparse(url)
  print(f'Downloading CT from {parsed_url.hostname} to {sample_dir}')
  download_ct(url, os.path.join(sample_dir, 'ct.nii.gz'))
  print(f'Downloaded CT to {sample_dir}')
  
  test_loader, val_transformers = get_loader(AttrDict({
    'space_x': space_x,
    'space_y': space_y,
    'space_z': space_z,
    'a_min': a_min,
    'a_max': a_max,
    'b_min': b_min,
    'b_max': b_max,
    'roi_x': roi_x,
    'roi_y': roi_y,
    'roi_z': roi_z,
    'num_samples': num_samples,
    'data_root_path': input_dir,
    'original_label': False,
    'cache_dataset': False,
    'phase': 'test',
  }))
  
  organ_data = validation(model, test_loader, val_transformers, AttrDict({
    'save_dir': output_dir,
    'data_root_path': input_dir,
    'roi_x': roi_x,
    'roi_y': roi_y,
    'roi_z': roi_z,
    'store_result': True,
    'create_dataset': False,
    'cpu': False,
    'backbone': backbone,
    'organ_indices': organ_indices,
    'include_combined': include_combined,
  }))
  
  result = {}
  
  # for name in glob.glob(os.path.join(output_dir, 'sample', '*.nii.gz')):
  #   result[os.path.basename(name)] = base64.b64encode(open(name, 'rb').read()).decode('ascii')
  
  for name in glob.glob(os.path.join(output_dir, 'sample/segmentations', '*.nii.gz')):
    organ_name = os.path.basename(name).split('.')[0]
    result[organ_name] = {
      **organ_data[organ_name],
      'content': base64.b64encode(open(name, 'rb').read()).decode('ascii'),
    }
    # result[os.path.basename(name)] = base64.b64encode(open(name, 'rb').read()).decode('ascii')

  workdir.cleanup()
  
  return result

runpod.serverless.start({"handler": handler})
