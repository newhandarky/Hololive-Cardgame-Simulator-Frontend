import { useMemo, useState, type ChangeEvent, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAdminCard, type AdminCreateCardRequest, type CardSummary } from '../services/api';

type CardType = AdminCreateCardRequest['cardType'];

type CardAdminForm = {
  cardId: string;
  name: string;
  rarity: string;
  imageUrl: string;
  cardType: CardType;
  life: string;
  mainColor: string;
  subColor: string;
  hp: string;
  levelType: 'DEBUT' | 'FIRST' | 'SECOND';
  bloomLevel: string;
  passiveEffectJson: string;
  triggerCondition: string;
  limited: boolean;
  conditionType: string;
  conditionJson: string;
  effectType: string;
  effectJson: string;
  targetType: 'SELF' | 'ENEMY' | 'BOTH' | 'SELF_CENTER' | 'ENEMY_CENTER' | 'ANY_HOLOMEM';
  color: string;
};

const initialForm: CardAdminForm = {
  cardId: '',
  name: '',
  rarity: '',
  imageUrl: '',
  cardType: 'OSHI',
  life: '',
  mainColor: 'WHITE',
  subColor: '',
  hp: '',
  levelType: 'DEBUT',
  bloomLevel: '',
  passiveEffectJson: '{}',
  triggerCondition: '',
  limited: false,
  conditionType: '',
  conditionJson: '{}',
  effectType: '',
  effectJson: '{}',
  targetType: 'SELF',
  color: 'WHITE',
};

const normalizeOptional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const parseOptionalNumber = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

// 卡片管理頁：先做本地管理用途，後續再加角色權限控管
export const CardAdminPage: FC = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState<CardAdminForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [createdCard, setCreatedCard] = useState<CardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const typeHint = useMemo(() => {
    switch (form.cardType) {
      case 'OSHI':
        return 'OSHI 必填：life、mainColor';
      case 'MEMBER':
        return 'MEMBER 必填：hp、levelType、mainColor';
      case 'SUPPORT':
        return 'SUPPORT 必填：effectType、effectJson、targetType';
      case 'CHEER':
        return 'CHEER 必填：color';
      default:
        return '';
    }
  }, [form.cardType]);

  const handleInputChange =
    (key: keyof CardAdminForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = event.target.type === 'checkbox'
        ? (event.target as HTMLInputElement).checked
        : event.target.value;
      setForm((prev) => ({ ...prev, [key]: value }));
    };

  // 依卡片類型組裝送往後端的 payload，未使用欄位不送
  const buildPayload = (): AdminCreateCardRequest => {
    const basePayload: AdminCreateCardRequest = {
      cardId: form.cardId.trim(),
      name: form.name.trim(),
      rarity: normalizeOptional(form.rarity),
      imageUrl: normalizeOptional(form.imageUrl),
      cardType: form.cardType,
    };

    if (form.cardType === 'OSHI') {
      return {
        ...basePayload,
        life: parseOptionalNumber(form.life),
        mainColor: normalizeOptional(form.mainColor),
        subColor: normalizeOptional(form.subColor),
      };
    }

    if (form.cardType === 'MEMBER') {
      return {
        ...basePayload,
        hp: parseOptionalNumber(form.hp),
        levelType: form.levelType,
        mainColor: normalizeOptional(form.mainColor),
        subColor: normalizeOptional(form.subColor),
        bloomLevel: parseOptionalNumber(form.bloomLevel),
        passiveEffectJson: normalizeOptional(form.passiveEffectJson),
        triggerCondition: normalizeOptional(form.triggerCondition),
      };
    }

    if (form.cardType === 'SUPPORT') {
      return {
        ...basePayload,
        limited: form.limited,
        conditionType: normalizeOptional(form.conditionType),
        conditionJson: normalizeOptional(form.conditionJson),
        effectType: normalizeOptional(form.effectType),
        effectJson: normalizeOptional(form.effectJson),
        targetType: form.targetType,
      };
    }

    return {
      ...basePayload,
      color: normalizeOptional(form.color),
    };
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setCreatedCard(null);
    try {
      const payload = buildPayload();
      const created = await createAdminCard(payload);
      setCreatedCard(created);
    } catch (err) {
      console.error(err);
      setError('建立卡片失敗，請檢查必填欄位與 JSON 格式。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel">
      <h1>Card Admin</h1>
      <p>目前先開放給登入使用者使用，後續可再加上只有你能看的權限控管。</p>

      <div className="row">
        <button type="button" onClick={() => navigate('/lobby')}>
          回到 Lobby
        </button>
      </div>

      <div className="card-admin-grid">
        <label className="card-admin-field">
          <span>Card ID *</span>
          <input value={form.cardId} onChange={handleInputChange('cardId')} placeholder="例如：MEM-003" />
        </label>
        <label className="card-admin-field">
          <span>Name *</span>
          <input value={form.name} onChange={handleInputChange('name')} placeholder="例如：星街すいせい SECOND" />
        </label>
        <label className="card-admin-field">
          <span>Card Type *</span>
          <select value={form.cardType} onChange={handleInputChange('cardType')}>
            <option value="OSHI">OSHI</option>
            <option value="MEMBER">MEMBER</option>
            <option value="SUPPORT">SUPPORT</option>
            <option value="CHEER">CHEER</option>
          </select>
        </label>
        <label className="card-admin-field">
          <span>Rarity</span>
          <input value={form.rarity} onChange={handleInputChange('rarity')} placeholder="例如：R / SR" />
        </label>
        <label className="card-admin-field card-admin-field--full">
          <span>Image URL</span>
          <input value={form.imageUrl} onChange={handleInputChange('imageUrl')} placeholder="https://..." />
        </label>
      </div>

      <p className="card-admin-hint">{typeHint}</p>

      {form.cardType === 'OSHI' ? (
        <div className="card-admin-grid">
          <label className="card-admin-field">
            <span>Life *</span>
            <input type="number" min={1} value={form.life} onChange={handleInputChange('life')} />
          </label>
          <label className="card-admin-field">
            <span>Main Color *</span>
            <input value={form.mainColor} onChange={handleInputChange('mainColor')} placeholder="WHITE" />
          </label>
          <label className="card-admin-field">
            <span>Sub Color</span>
            <input value={form.subColor} onChange={handleInputChange('subColor')} placeholder="GREEN" />
          </label>
        </div>
      ) : null}

      {form.cardType === 'MEMBER' ? (
        <div className="card-admin-grid">
          <label className="card-admin-field">
            <span>HP *</span>
            <input type="number" min={1} value={form.hp} onChange={handleInputChange('hp')} />
          </label>
          <label className="card-admin-field">
            <span>Level Type *</span>
            <select value={form.levelType} onChange={handleInputChange('levelType')}>
              <option value="DEBUT">DEBUT</option>
              <option value="FIRST">FIRST</option>
              <option value="SECOND">SECOND</option>
            </select>
          </label>
          <label className="card-admin-field">
            <span>Main Color *</span>
            <input value={form.mainColor} onChange={handleInputChange('mainColor')} placeholder="WHITE" />
          </label>
          <label className="card-admin-field">
            <span>Sub Color</span>
            <input value={form.subColor} onChange={handleInputChange('subColor')} placeholder="GREEN" />
          </label>
          <label className="card-admin-field">
            <span>Bloom Level</span>
            <input type="number" min={0} value={form.bloomLevel} onChange={handleInputChange('bloomLevel')} />
          </label>
          <label className="card-admin-field card-admin-field--full">
            <span>Trigger Condition</span>
            <input value={form.triggerCondition} onChange={handleInputChange('triggerCondition')} />
          </label>
          <label className="card-admin-field card-admin-field--full">
            <span>Passive Effect JSON</span>
            <textarea rows={4} value={form.passiveEffectJson} onChange={handleInputChange('passiveEffectJson')} />
          </label>
        </div>
      ) : null}

      {form.cardType === 'SUPPORT' ? (
        <div className="card-admin-grid">
          <label className="card-admin-field card-admin-field--checkbox">
            <span>Limited</span>
            <input type="checkbox" checked={form.limited} onChange={handleInputChange('limited')} />
          </label>
          <label className="card-admin-field">
            <span>Target Type *</span>
            <select value={form.targetType} onChange={handleInputChange('targetType')}>
              <option value="SELF">SELF</option>
              <option value="ENEMY">ENEMY</option>
              <option value="BOTH">BOTH</option>
              <option value="SELF_CENTER">SELF_CENTER</option>
              <option value="ENEMY_CENTER">ENEMY_CENTER</option>
              <option value="ANY_HOLOMEM">ANY_HOLOMEM</option>
            </select>
          </label>
          <label className="card-admin-field">
            <span>Effect Type *</span>
            <input value={form.effectType} onChange={handleInputChange('effectType')} placeholder="DRAW / BUFF..." />
          </label>
          <label className="card-admin-field card-admin-field--full">
            <span>Condition Type</span>
            <input value={form.conditionType} onChange={handleInputChange('conditionType')} />
          </label>
          <label className="card-admin-field card-admin-field--full">
            <span>Condition JSON</span>
            <textarea rows={4} value={form.conditionJson} onChange={handleInputChange('conditionJson')} />
          </label>
          <label className="card-admin-field card-admin-field--full">
            <span>Effect JSON *</span>
            <textarea rows={4} value={form.effectJson} onChange={handleInputChange('effectJson')} />
          </label>
        </div>
      ) : null}

      {form.cardType === 'CHEER' ? (
        <div className="card-admin-grid">
          <label className="card-admin-field">
            <span>Color *</span>
            <input value={form.color} onChange={handleInputChange('color')} placeholder="WHITE" />
          </label>
        </div>
      ) : null}

      <div className="row">
        <button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? '建立中...' : '建立卡片'}
        </button>
      </div>

      {createdCard ? (
        <p className="card-admin-success">
          已建立卡片：<span className="mono">{createdCard.cardId}</span> / {createdCard.name} ({createdCard.cardType})
        </p>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </section>
  );
};
