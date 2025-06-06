import { Amplify } from 'aws-amplify';
import { post } from 'aws-amplify/api';
import moment from 'moment';

Amplify.configure({
  API: {
    REST: {
      addfaces: {
        endpoint: "https://p3evh1int9.execute-api.us-east-1.amazonaws.com/prod",
        region: "us-east-1"
      }
    }
  }
});

async function addFaceRekognitionService(images, imageName, ExternalImageId, collection_id) {
  const apiName = "addfaces";
  const path = "/addfaces";
  const body = {
    name: imageName,
    Image: images,
    ExternalImageId: ExternalImageId,
    collection_id: collection_id
  };
  const init = {
    headers: {
      "X-Amz-Target": "RekognitionService.IndexFaces",
      "Content-Type": "application/x-amz-json-1.1"
    },
    body
  };

  const response = await post({ apiName, path, options: init }).response;
  return await response.body.json();
}

async function searchFaceImages(base64, filename, collection_id) {
  const apiName = "addfaces";
  const path = "/searchface";
  const body = {
    name: filename,
    Image: base64,
    collection_id
  };
  const init = {
    headers: {
      'Accept': 'application/json',
      "X-Amz-Target": "RekognitionService.SearchFacesByImage",
      "Content-Type": "application/x-amz-json-1.1"
    },
    body
  };

  const response = await post({ apiName, path, options: init }).response;
  return await response.body.json();
}

export { addFaceRekognitionService, searchFaceImages };
