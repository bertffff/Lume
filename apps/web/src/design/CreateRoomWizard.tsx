import {
  createRoomSchema, defaultViewerFlags, parseEmbedInput, roomPresetById, roomPresets, viewerPermissionKeys,
  type RoomCategorySelection, type RoomPresetId, type ViewerDefaultFlags,
} from "@lume/contracts";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useI18n } from "../i18n/context.js";
import { Modal } from "../ui/Modal.js";
import { permissionLabel } from "./copy.js";
import "./create-room-wizard.css";

const steps = ["video", "access", "rights"] as const;
const categories = ["auto", "film", "music", "vlog", "other"] as const satisfies readonly RoomCategorySelection[];
const videoUrlMaxLength = 2000;
type Step = (typeof steps)[number];

export interface CreateRoomWizardLabels {
  steps: Record<Step, string>;
  presetOptions: Record<RoomPresetId, { name: string; hint: string }>;
  videoUrl: string;
  category: string;
  categories: Record<RoomCategorySelection, string>;
  invalidTitle: string;
  invalidVideoUrl: string;
}

export interface CreateRoomWizardSubmission {
  title: string;
  initialVideoUrl?: string;
  categorySelection: RoomCategorySelection;
  isPublic: boolean;
  defaults: ViewerDefaultFlags;
  preset?: RoomPresetId;
}

type CreateRoomWizardProps = {
  open: boolean;
  labels: CreateRoomWizardLabels;
  onClose: () => void;
  onSubmit: (submission: CreateRoomWizardSubmission) => Promise<void | { error: string }>;
};

type Draft = Omit<CreateRoomWizardSubmission, "initialVideoUrl"> & { videoUrl: string };
type InvalidFields = Partial<Record<"title" | "videoUrl", true>>;

const initialDraft: Draft = {
  title: "", videoUrl: "", categorySelection: "auto", isPublic: true, defaults: defaultViewerFlags,
};

export function CreateRoomWizard({ open, ...props }: CreateRoomWizardProps) {
  return open ? <OpenWizard {...props} /> : null;
}

function OpenWizard({ labels, onClose, onSubmit }: Omit<CreateRoomWizardProps, "open">) {
  const { t } = useI18n();
  const formId = useId();
  const [step, setStep] = useState<Step>("video");
  const [draft, setDraft] = useState(initialDraft);
  const [invalid, setInvalid] = useState<InvalidFields>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const preset = roomPresetById(draft.preset);

  useEffect(() => {
    if (previousStep.current !== step) stepHeading.current?.focus();
    previousStep.current = step;
  }, [step]);

  function updateDraft(update: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...update }));
    setSubmitError(null);
  }

  function updateDetail(field: "title" | "videoUrl", value: string) {
    updateDraft({ [field]: value });
    setInvalid((current) => ({ ...current, [field]: undefined }));
  }

  function selectPreset(id: RoomPresetId) {
    const selected = roomPresetById(id);
    if (!selected) return;
    const usesSuggestedTitle = !draft.title.trim() || (preset && draft.title === labels.presetOptions[preset.id].name);
    const title = usesSuggestedTitle ? labels.presetOptions[id].name : draft.title;
    updateDraft({ preset: id, title, isPublic: selected.isPublic, defaults: { ...selected.defaults } });
    if (usesSuggestedTitle) setInvalid((current) => ({ ...current, title: undefined }));
  }

  function validateDetails() {
    const titleInvalid = !createRoomSchema.shape.title.safeParse(draft.title).success;
    const url = draft.videoUrl.trim();
    const videoInvalid = url !== "" && (url.length > videoUrlMaxLength || !parseEmbedInput(url));
    setInvalid({ title: titleInvalid || undefined, videoUrl: videoInvalid || undefined });
    if (titleInvalid) titleInput.current?.focus();
    else if (videoInvalid) videoInput.current?.focus();
    return !titleInvalid && !videoInvalid;
  }

  async function submit() {
    pending.current = true;
    setBusy(true);
    setSubmitError(null);
    const { videoUrl, title, ...settings } = draft;
    const url = videoUrl.trim();
    try {
      const result = await onSubmit({ ...settings, title: title.trim(), ...(url ? { initialVideoUrl: url } : {}) });
      if (result) setSubmitError(result.error);
    } catch {
      setSubmitError(t("room.createFailed"));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    if (step === "video") {
      if (validateDetails()) setStep("access");
    } else if (step === "access") setStep("rights");
    else void submit();
  }

  return (
    <Modal
      open lg title={t("create.title")} testId="create-room-wizard" closeTestId="create-close"
      onClose={() => { if (!pending.current) onClose(); }}
      footer={
        <div className="create-wizard__actions">
          {step === "video" ? (
            <button type="button" data-testid="create-cancel" onClick={onClose}>{t("common.cancel")}</button>
          ) : (
            <button type="button" data-testid="create-back" disabled={busy} onClick={() => {
              setSubmitError(null);
              setStep(step === "rights" ? "access" : "video");
            }}>{t("join.back")}</button>
          )}
          {step === "rights" ? (
            <button type="submit" form={formId} className="btn btn-primary" data-testid="lobby-create" disabled={busy} aria-busy={busy || undefined}>
              {busy ? t("create.creating") : t("create.submit")}
            </button>
          ) : (
            <button type="submit" form={formId} className="btn btn-primary" data-testid="create-next">{t("join.next")}</button>
          )}
        </div>
      }
    >
      <form id={formId} className="create-wizard" onSubmit={handleSubmit} noValidate>
        <ol className="create-wizard__steps" role="list">
          {steps.map((item, index) => (
            <li key={item} aria-current={item === step ? "step" : undefined}>
              <span aria-hidden="true">{index + 1}</span>{labels.steps[item]}
            </li>
          ))}
        </ol>
        <h3 tabIndex={-1} ref={stepHeading} data-testid={`create-step-${step}`}>{labels.steps[step]}</h3>
        {step === "video" && (
          <>
            <fieldset>
              <legend>{t("create.preset")}</legend>
              <div className="create-wizard__presets" data-testid="create-presets">
                {roomPresets.map(({ id }) => (
                  <button type="button" key={id} aria-pressed={draft.preset === id} data-testid={`create-preset-${id}`} onClick={() => selectPreset(id)}>
                    {labels.presetOptions[id].name}
                  </button>
                ))}
              </div>
              {preset && (
                <p className="create-wizard__hint" data-testid="create-preset-summary" data-max={preset.maxMembers} data-slow={preset.slowModeSeconds} data-public={preset.isPublic}>
                  {labels.presetOptions[preset.id].hint}
                </p>
              )}
            </fieldset>
            <div className="create-wizard__field">
              <label htmlFor={`${formId}-title`}>{t("create.roomName")}</label>
              <input
                ref={titleInput} id={`${formId}-title`} data-testid="lobby-title" required value={draft.title}
                placeholder={t("create.namePlaceholder")} aria-invalid={invalid.title}
                aria-describedby={invalid.title ? `${formId}-title-error` : undefined}
                onChange={(event) => updateDetail("title", event.target.value)}
              />
              {invalid.title && <p id={`${formId}-title-error`} role="alert">{labels.invalidTitle}</p>}
            </div>
            <div className="create-wizard__field">
              <label htmlFor={`${formId}-video`}>{labels.videoUrl}</label>
              <input
                ref={videoInput} id={`${formId}-video`} data-testid="create-video-url" type="url" value={draft.videoUrl}
                aria-invalid={invalid.videoUrl} aria-describedby={invalid.videoUrl ? `${formId}-video-error` : undefined}
                onChange={(event) => updateDetail("videoUrl", event.target.value)}
              />
              {invalid.videoUrl && <p id={`${formId}-video-error`} role="alert">{labels.invalidVideoUrl}</p>}
            </div>
            <div className="create-wizard__field">
              <label htmlFor={`${formId}-category`}>{labels.category}</label>
              <select
                id={`${formId}-category`} data-testid="create-category" value={draft.categorySelection}
                onChange={(event) => {
                  const selected = categories.find((category) => category === event.target.value);
                  if (selected) updateDraft({ categorySelection: selected });
                }}
              >
                {categories.map((category) => <option key={category} value={category}>{labels.categories[category]}</option>)}
              </select>
            </div>
          </>
        )}
        {step === "access" && (
          <fieldset>
            <legend>{t("create.who")}</legend>
            <div className="create-wizard__choices">
              {(["byCode", "public"] as const).map((access) => (
                <label className="create-wizard__choice" key={access}>
                  <input
                    type="radio" name="access" data-testid={`create-access-${access}`} aria-labelledby={`${formId}-${access}-label`} aria-describedby={`${formId}-${access}-hint`}
                    checked={draft.isPublic === (access === "public")} onChange={() => updateDraft({ isPublic: access === "public" })}
                  />
                  <span id={`${formId}-${access}-label`}>{t(`create.${access}`)}</span>
                  <small id={`${formId}-${access}-hint`}>{t(`create.${access}Hint`)}</small>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {step === "rights" && (
          <fieldset disabled={busy}>
            <legend>{t("create.rights")}</legend>
            <div className="create-wizard__choices" data-testid="create-preset-rights">
              {viewerPermissionKeys.map((key) => (
                <label className="create-wizard__choice" key={key}>
                  <input
                    type="checkbox" data-testid={`create-permission-${key}`} checked={draft.defaults[key]}
                    onChange={(event) => updateDraft({ defaults: { ...draft.defaults, [key]: event.target.checked } })}
                  />
                  <span>{permissionLabel(key, t)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {submitError && <p role="alert">{submitError}</p>}
      </form>
    </Modal>
  );
}
