import { safeFetchJson } from '@/shared/lib/fetch/server';

import {
  AIMediaType,
  AITaskStatus,
  type AIConfigs,
  type AIGenerateParams,
  type AIProvider,
  type AISong,
  type AITaskResult,
} from '.';

type KieGenerateData = { taskId: string } & Record<string, unknown>;

type KieGenerateResponse = {
  code: number;
  msg: string;
  data?: KieGenerateData;
};

type KieSunoSong = {
  id: string;
  createTime: string;
  audioUrl: string;
  imageUrl: string;
  duration: number;
  prompt: string;
  title: string;
  tags: string;
  style: string;
  modelName?: string;
  artist?: string;
  album?: string;
};

type KieQueryData = {
  status: string;
  response?: { sunoData?: KieSunoSong[] };
  errorCode?: string;
  errorMessage?: string;
  createTime?: string;
} & Record<string, unknown>;

type KieQueryResponse = {
  code: number;
  msg: string;
  data?: KieQueryData;
};

/**
 * Kie configs
 * @docs https://kie.ai/
 */
export interface KieConfigs extends AIConfigs {
  apiKey: string;
}

/**
 * Kie provider
 * @docs https://kie.ai/
 */
export class KieProvider implements AIProvider {
  // provider name
  readonly name = 'kie';
  // provider configs
  configs: KieConfigs;

  // api base url
  private baseUrl = 'https://api.kie.ai/api/v1';

  // init provider
  constructor(configs: KieConfigs) {
    this.configs = configs;
  }

  async generateMusic({
    params,
  }: {
    params: AIGenerateParams;
  }): Promise<AITaskResult> {
    const apiUrl = `${this.baseUrl}/generate`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.configs.apiKey}`,
    };

    // todo: check model
    if (!params.model) {
      params.model = 'V5';
    }

    // build request params
    const payload: Record<string, unknown> = {
      prompt: params.prompt,
      model: params.model,
      callBackUrl: params.callbackUrl,
    };

    if (
      params.options &&
      (params.options as { customMode?: boolean }).customMode
    ) {
      const customOptions = params.options as {
        customMode?: boolean;
        title?: string;
        style?: string;
        instrumental?: boolean;
        lyrics?: string;
      };
      // custom mode
      payload.customMode = true;
      payload.title = customOptions.title;
      payload.style = customOptions.style;
      payload.instrumental = customOptions.instrumental;
      if (!customOptions.instrumental) {
        // not instrumental, lyrics is used as prompt
        payload.prompt = customOptions.lyrics;
      }
    } else {
      // not custom mode
      payload.customMode = false;
      payload.prompt = params.prompt;
      payload.instrumental = (
        params.options as { instrumental?: boolean }
      )?.instrumental;
    }

    // const params = {
    //   customMode: false,
    //   instrumental: false,
    //   style: "",
    //   title: "",
    //   prompt: prompt || "",
    //   model: model || "V4_5",
    //   callBackUrl,
    //   negativeTags: "",
    //   vocalGender: "m", // m or f
    //   styleWeight: 0.65,
    //   weirdnessConstraint: 0.65,
    //   audioWeight: 0.65,
    // };

    const { code, msg, data } = await safeFetchJson<KieGenerateResponse>(
      apiUrl,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
      {
        timeoutMs: 15000,
        cache: 'no-store',
        errorMessage: 'request kie api failed',
      }
    );

    if (code !== 200) {
      throw new Error(`generate music failed: ${msg}`);
    }

    if (!data || !data.taskId) {
      throw new Error(`generate music failed: no taskId`);
    }

    return {
      taskStatus: AITaskStatus.PENDING,
      taskId: data.taskId,
      taskInfo: {},
      taskResult: data,
    };
  }

  // generate task
  async generate({
    params,
  }: {
    params: AIGenerateParams;
  }): Promise<AITaskResult> {
    if (params.mediaType !== AIMediaType.MUSIC) {
      throw new Error(`mediaType not supported: ${params.mediaType}`);
    }

    return this.generateMusic({ params });
  }

  // query task
  async query({ taskId }: { taskId: string }): Promise<AITaskResult> {
    const apiUrl = `${this.baseUrl}/generate/record-info?taskId=${taskId}`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.configs.apiKey}`,
    };

    const { code, msg, data } = await safeFetchJson<KieQueryResponse>(
      apiUrl,
      {
        method: 'GET',
        headers,
      },
      {
        timeoutMs: 15000,
        cache: 'no-store',
        errorMessage: 'request kie api failed',
      }
    );

    if (code !== 200) {
      throw new Error(msg);
    }

    if (!data || !data.status) {
      throw new Error(`query failed`);
    }

    const songs = data.response?.sunoData?.map(
      (song): AISong => ({
        id: song.id,
        createTime: new Date(song.createTime),
        audioUrl: song.audioUrl,
        imageUrl: song.imageUrl,
        duration: song.duration,
        prompt: song.prompt,
        title: song.title,
        tags: song.tags,
        style: song.style,
        model: song.modelName,
        artist: song.artist,
        album: song.album,
      })
    );

    return {
      taskId,
      taskStatus: this.mapStatus(data.status),
      taskInfo: {
        songs,
        status: data.status,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        createTime: data.createTime ? new Date(data.createTime) : undefined,
      },
      taskResult: data,
    };
  }

  // map status
  private mapStatus(status: string): AITaskStatus {
    switch (status) {
      case 'PENDING':
        return AITaskStatus.PENDING;
      case 'TEXT_SUCCESS':
        return AITaskStatus.PROCESSING;
      case 'FIRST_SUCCESS':
        return AITaskStatus.PROCESSING;
      case 'SUCCESS':
        return AITaskStatus.SUCCESS;
      case 'CREATE_TASK_FAILED':
      case 'GENERATE_AUDIO_FAILED':
      case 'CALLBACK_EXCEPTION':
      case 'SENSITIVE_WORD_ERROR':
        return AITaskStatus.FAILED;
      default:
        throw new Error(`unknown status: ${status}`);
    }
  }
}
