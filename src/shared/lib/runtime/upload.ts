import { getRuntimePlatform, type RuntimePlatform } from './env.server';
import { readRequestFormData } from './request-body';

export function isFileUploadValue(value: FormDataEntryValue): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

export async function readUploadRequestInput(
  req: Request,
  fieldName = 'files'
): Promise<{
  runtimePlatform: RuntimePlatform;
  formData: FormData;
  entries: FormDataEntryValue[];
  files: File[];
}> {
  const formData = await readRequestFormData(req);
  const entries = formData.getAll(fieldName);

  return {
    runtimePlatform: getRuntimePlatform(),
    formData,
    entries,
    files: entries.filter(isFileUploadValue),
  };
}
