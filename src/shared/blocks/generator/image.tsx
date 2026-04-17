'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  CreditCard,
  Download,
  ImageIcon,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/core/i18n/navigation';
import { AIMediaType, AITaskStatus } from '@/extensions/ai';
import {
  ImageUploader,
  type ImageUploaderValue,
} from '@/shared/blocks/common/image-uploader';
import { LazyImage } from '@/shared/blocks/common/lazy-image';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Progress } from '@/shared/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  type AIGenerationTaskAdapter,
  useAiGenerationController,
} from '@/shared/hooks/use-ai-generation-controller';
import { useBlobDownload } from '@/shared/hooks/use-blob-download';

interface ImageGeneratorProps {
  allowMultipleImages?: boolean;
  maxImages?: number;
  maxSizeMB?: number;
  srOnlyTitle?: string;
}

interface GeneratedImage {
  id: string;
  url: string;
  provider?: string;
  model?: string;
  prompt?: string;
}

const MAX_PROMPT_LENGTH = 2000;

interface ImageTaskResult extends Record<string, unknown> {
  images?: Array<
    | {
        imageUrl?: string;
        url?: string;
      }
    | string
    | null
    | undefined
  >;
  errorMessage?: string;
  errorCode?: string;
  status?: string;
}

type BackendTaskInfo = ImageTaskResult;

function extractImageUrlsFromTaskInfo(
  taskInfo: BackendTaskInfo | null
): string[] {
  if (!taskInfo?.images || !Array.isArray(taskInfo.images)) {
    return [];
  }

  return taskInfo.images
    .map((image) => {
      if (!image) return undefined;
      if (typeof image === 'string') return image;
      if (typeof image === 'object') {
        if (typeof image.imageUrl === 'string') return image.imageUrl;
        if (typeof image.url === 'string') return image.url;
      }
      return undefined;
    })
    .filter((url): url is string => Boolean(url));
}

export function ImageGenerator({
  allowMultipleImages = true,
  maxImages = 9,
  maxSizeMB = 5,
  srOnlyTitle,
}: ImageGeneratorProps) {
  const t = useTranslations('ai.image.generator');

  const [prompt, setPrompt] = useState('');
  const [referenceImageItems, setReferenceImageItems] = useState<
    ImageUploaderValue[]
  >([]);
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const { downloadingId: downloadingImageId, downloadBlob } = useBlobDownload();

  const imageTaskAdapter = useMemo<AIGenerationTaskAdapter<BackendTaskInfo | null>>(
    () => ({
      initialProgress: 15,
      pollIntervalMs: 5000,
      timeoutMs: 180000,
      parsePollingPayload: (task) => task.taskInfo as BackendTaskInfo | null,
      onStart: () => {
        setGeneratedImages([]);
      },
      handlePending: ({ helpers: { setProgress } }) => {
        setProgress((prev) => Math.max(prev, 20));
      },
      handleProcessing: ({ task, payload, helpers: { setProgress } }) => {
        const imageUrls = extractImageUrlsFromTaskInfo(payload);

        if (imageUrls.length > 0) {
          setGeneratedImages(
            imageUrls.map((url, index) => ({
              id: `${task.id}-${index}`,
              url,
              provider: task.provider,
              model: task.model ?? undefined,
              prompt: task.prompt ?? undefined,
            }))
          );
          setProgress((prev) => Math.max(prev, 85));
          return;
        }

        setProgress((prev) => Math.min(prev + 10, 80));
      },
      handleSuccess: ({ task, payload }) => {
        const imageUrls = extractImageUrlsFromTaskInfo(payload);

        if (imageUrls.length === 0) {
          toast.error(t('errors.no_images_returned'));
          return;
        }

        setGeneratedImages(
          imageUrls.map((url, index) => ({
            id: `${task.id}-${index}`,
            url,
            provider: task.provider,
            model: task.model ?? undefined,
            prompt: task.prompt ?? undefined,
          }))
        );
        toast.success(t('messages.generated_success'));
      },
      handleFailed: ({ payload }) => {
        const errorMessage = payload?.errorMessage;
        return typeof errorMessage === 'string' && errorMessage.trim()
          ? errorMessage
          : t('errors.generate_failed');
      },
    }),
    [t]
  );

  const {
    details,
    remainingCredits,
    costCredits,
    capabilities,
    scene,
    provider,
    model,
    setScene,
    setProvider,
    setModel,
    selectedCapability,
    isLoadingCapabilities,
    isLoadingDetails,
    accountErrorMessage,
    capabilityErrorMessage,
    isGenerating,
    progress,
    taskStatus,
    run,
  } = useAiGenerationController<{
    prompt: string;
    referenceImageUrls: string[];
  }>({
    mediaType: AIMediaType.IMAGE,
    buildRequestBody: ({ formState, capability }) => {
      const options: { image_input?: string[] } = {};

      if (capability.scene === 'image-to-image') {
        options.image_input = formState.referenceImageUrls;
      }

      return {
        mediaType: AIMediaType.IMAGE,
        scene: capability.scene,
        provider: capability.provider,
        model: capability.model,
        prompt: formState.prompt,
        options,
      };
    },
    adapter: imageTaskAdapter,
    messages: {
      loadAccountDetailsFailed: 'Failed to load account details',
      refreshAccountDetailsFailed: 'Failed to refresh account details',
      loadCapabilitiesFailed: 'Failed to load AI capabilities',
      invalidProviderOrModel: t('errors.invalid_provider_or_model'),
      insufficientCredits: t('errors.insufficient_credits'),
      createTaskFailed: t('errors.create_task_failed'),
      queryTaskFailed: t('errors.query_task_failed'),
      timeout: t('errors.timeout'),
      unknownError: t('errors.unknown_error'),
      createTaskFailedWithReason: (reason) =>
        t('errors.generate_failed_with_reason', { reason }),
      queryTaskFailedWithReason: (reason) =>
        t('errors.query_task_failed_with_reason', { reason }),
    },
  });

  const promptLength = prompt.trim().length;
  const isPromptTooLong = promptLength > MAX_PROMPT_LENGTH;
  const isTextToImageMode = scene === 'text-to-image';
  const effectiveCapabilityErrorMessage =
    capabilityErrorMessage ||
    (!isLoadingCapabilities && capabilities.length === 0
      ? t('errors.invalid_provider_or_model')
      : null);

  const providerOptions = useMemo(() => {
    return Array.from(
      new Set(
        capabilities
          .filter((capability) => capability.scene === scene)
          .map((capability) => capability.provider)
      )
    ).map((value) => ({
      value,
      label: value,
    }));
  }, [capabilities, scene]);

  const modelOptions = useMemo(() => {
    return capabilities
      .filter(
        (capability) =>
          capability.scene === scene && capability.provider === provider
      )
      .map((capability) => ({
        value: capability.model,
        label: capability.label,
      }));
  }, [capabilities, provider, scene]);

  const sceneOptions = useMemo(() => {
    return Array.from(new Set(capabilities.map((capability) => capability.scene)));
  }, [capabilities]);

  const handleTabChange = useCallback((value: string) => {
    setScene(value);
  }, [setScene]);

  const taskStatusLabel = useMemo(() => {
    if (!taskStatus) {
      return '';
    }

    switch (taskStatus) {
      case AITaskStatus.PENDING:
        return t('status.pending');
      case AITaskStatus.PROCESSING:
        return t('status.processing');
      case AITaskStatus.SUCCESS:
        return t('status.success');
      case AITaskStatus.FAILED:
        return t('status.failed');
      default:
        return '';
    }
  }, [taskStatus, t]);

  const handleReferenceImagesChange = useCallback(
    (items: ImageUploaderValue[]) => {
      setReferenceImageItems(items);
      const uploadedUrls = items
        .filter((item) => item.status === 'uploaded' && item.url)
        .map((item) => item.url as string);
      setReferenceImageUrls(uploadedUrls);
    },
    []
  );

  const isReferenceUploading = useMemo(
    () => referenceImageItems.some((item) => item.status === 'uploading'),
    [referenceImageItems]
  );

  const hasReferenceUploadError = useMemo(
    () => referenceImageItems.some((item) => item.status === 'error'),
    [referenceImageItems]
  );

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      toast.error(t('errors.prompt_required'));
      return;
    }

    if (!isTextToImageMode && referenceImageUrls.length === 0) {
      toast.error(t('errors.reference_images_required'));
      return;
    }

    await run({
      prompt: trimmedPrompt,
      referenceImageUrls,
    });
  };

  const handleDownloadImage = async (image: GeneratedImage) => {
    if (!image.url) {
      return;
    }

    await downloadBlob({
      id: image.id,
      url: image.url,
      fileName: `${image.id}.png`,
      successMessage: t('messages.download_success'),
      errorMessage: t('errors.download_failed'),
    });
  };

  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                {srOnlyTitle && <h2 className="sr-only">{srOnlyTitle}</h2>}
                <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                  {t('title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pb-8">
                {sceneOptions.length > 0 && (
                  <Tabs value={scene} onValueChange={handleTabChange}>
                    <TabsList
                      className="bg-primary/10 grid w-full"
                      style={{
                        gridTemplateColumns: `repeat(${sceneOptions.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {sceneOptions.map((sceneOption) => (
                        <TabsTrigger key={sceneOption} value={sceneOption}>
                          {t(`tabs.${sceneOption}`)}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('form.provider')}</Label>
                    <Select value={provider} onValueChange={setProvider}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('form.select_provider')} />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('form.model')}</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('form.select_model')} />
                      </SelectTrigger>
                      <SelectContent>
                        {modelOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {!isTextToImageMode && (
                  <div className="space-y-4">
                    <ImageUploader
                      title={t('form.reference_image')}
                      allowMultiple={allowMultipleImages}
                      maxImages={allowMultipleImages ? maxImages : 1}
                      maxSizeMB={maxSizeMB}
                      onChange={handleReferenceImagesChange}
                      emptyHint={t('form.reference_image_placeholder')}
                    />

                    {hasReferenceUploadError && (
                      <p className="text-destructive text-xs">
                        {t('form.some_images_failed_to_upload')}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="image-prompt">{t('form.prompt')}</Label>
                  <Textarea
                    id="image-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={t('form.prompt_placeholder')}
                    className="min-h-32"
                  />
                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>
                      {promptLength} / {MAX_PROMPT_LENGTH}
                    </span>
                    {isPromptTooLong && (
                      <span className="text-destructive">
                        {t('form.prompt_too_long')}
                      </span>
                    )}
                  </div>
                </div>

                {((isLoadingDetails && !details && !isGenerating) ||
                  isLoadingCapabilities) && !effectiveCapabilityErrorMessage ? (
                  <Button className="w-full" disabled size="lg">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('checking_account')}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleGenerate}
                    disabled={
                      isGenerating ||
                      !prompt.trim() ||
                      isPromptTooLong ||
                      isReferenceUploading ||
                      hasReferenceUploadError ||
                      !selectedCapability ||
                      isLoadingCapabilities
                    }
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('generating')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        {t('generate')}
                      </>
                    )}
                  </Button>
                )}

                {accountErrorMessage ? (
                  <div className="space-y-2 rounded-lg border border-destructive/30 p-4 text-sm">
                    <p className="text-destructive">{accountErrorMessage}</p>
                    <p className="text-muted-foreground">{t('checking_account')}</p>
                  </div>
                ) : effectiveCapabilityErrorMessage ? (
                  <div className="space-y-2 rounded-lg border border-destructive/30 p-4 text-sm">
                    <p className="text-destructive">
                      {effectiveCapabilityErrorMessage}
                    </p>
                    <p className="text-muted-foreground">{t('checking_account')}</p>
                  </div>
                ) : details && remainingCredits > 0 ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-primary">
                      {t('credits_cost', { credits: costCredits })}
                    </span>
                    <span>
                      {t('credits_remaining', { credits: remainingCredits })}
                    </span>
                  </div>
                ) : details ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-primary">
                        {t('credits_cost', { credits: costCredits })}
                      </span>
                      <span>
                        {t('credits_remaining', { credits: remainingCredits })}
                      </span>
                    </div>
                    <Link href="/pricing">
                      <Button variant="outline" className="w-full" size="lg">
                        <CreditCard className="mr-2 h-4 w-4" />
                        {t('buy_credits')}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-primary">
                      {t('credits_cost', { credits: costCredits })}
                    </span>
                    <Link href="/pricing">
                      <Button variant="outline" size="sm">
                        {t('buy_credits')}
                      </Button>
                    </Link>
                  </div>
                )}

                {isGenerating && (
                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span>{t('progress')}</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                    {taskStatusLabel && (
                      <p className="text-muted-foreground text-center text-xs">
                        {taskStatusLabel}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                  <ImageIcon className="h-5 w-5" />
                  {t('generated_images')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-8">
                {generatedImages.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {generatedImages.map((image) => (
                      <div key={image.id} className="space-y-3">
                        <div className="relative aspect-square overflow-hidden rounded-lg border">
                          <LazyImage
                            src={image.url}
                            alt={image.prompt || 'Generated image'}
                            fill
                            sizes="(max-width: 640px) 100vw, 50vw"
                            className="object-cover"
                          />

                          <div className="absolute right-2 bottom-2 flex justify-end text-sm">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-auto"
                              onClick={() => handleDownloadImage(image)}
                              disabled={downloadingImageId === image.id}
                            >
                              {downloadingImageId === image.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </>
                              ) : (
                                <>
                                  <Download className="h-4 w-4" />
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                      <ImageIcon className="text-muted-foreground h-10 w-10" />
                    </div>
                    <p className="text-muted-foreground">
                      {isGenerating
                        ? t('ready_to_generate')
                        : t('no_images_generated')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
