import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { BattlefieldPanel } from '../battlefield/BattlefieldPanel';
import { getCardDetail, type CardDetail, type PlaySupportActionRequest } from '../../services/api';
import type {
  AttachCheerActionRequest,
  AttackArtActionRequest,
  BloomActionRequest,
  GameState,
  LobbyMatch,
  MoveStageHolomemActionRequest,
  PendingDecision,
  PendingDecisionCandidate,
  PendingInteraction,
  RecentMatchAction,
  PlayToStageActionRequest,
  ResolveDecisionActionRequest,
  ZoneCardInstance,
} from '../../services/api';
import type { ZoneCardVisualInfo } from '../battlefield/FieldZone';

interface GameRoomScreenProps {
  currentMatch: LobbyMatch;
  currentGameState: GameState | null;
  wsStatus: string;
  myDisplayName: string;
  opponentDisplayName: string;
  currentUserId: number | null;
  busy: boolean;
  onPlayToStage: (payload: PlayToStageActionRequest) => Promise<void>;
  onPlaySupport: (payload: PlaySupportActionRequest) => Promise<void>;
  onBloom: (payload: BloomActionRequest) => Promise<void>;
  onAttachCheer: (payload: AttachCheerActionRequest) => Promise<void>;
  onAttackArt: (payload: AttackArtActionRequest) => Promise<void>;
  onDrawTurn: () => Promise<void>;
  onSendTurnCheer: () => Promise<void>;
  onMoveStageHolomem: (payload: MoveStageHolomemActionRequest) => Promise<void>;
  onResolveDecision: (payload: ResolveDecisionActionRequest) => Promise<void>;
  onEndTurn: () => Promise<void>;
  onBackToLobby: () => void;
}

type HandActionKind = 'PLAY_TO_STAGE' | 'PLAY_SUPPORT' | 'ATTACH_CHEER' | 'BLOOM';

interface HandActionDraft {
  card: ZoneCardInstance;
  kind: HandActionKind;
  targetZone: 'CENTER' | 'BACK';
  targetHolomemCardInstanceId: number | null;
}

interface CardVisualExt extends ZoneCardVisualInfo {
  cardType: string;
  supportEffectText?: string | null;
  memberEffectText?: string | null;
  levelType?: string | null;
}

interface StageMoveDraft {
  card: ZoneCardInstance;
  targetZone: 'CENTER' | 'COLLAB';
  movable: boolean;
  blockedReason?: string | null;
}

interface BloomActionSummary {
  diceRoll: number | null;
  requestedEffects: string[];
  executedEffects: string[];
  unsupportedEffects: string[];
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const asStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => item.length > 0);
};

const asEffectTypeList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const itemRecord = asRecord(item);
      return typeof itemRecord?.effectType === 'string' ? itemRecord.effectType.trim() : '';
    })
    .filter((item) => item.length > 0);
};

const SUPPORT_META_LINE_PATTERNS = [
  /^カードID[:：]?/i,
  /^h[a-z0-9-]+$/i,
  /^カードタイプ[:：]?/i,
  /^レアリティ[:：]?/i,
  /^収録商品[:：]?/i,
  /^MORE$/i,
];

const sanitizeSupportEffectText = (raw: string, cardName?: string): string | null => {
  const lines = raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return null;
  }

  const abilityIndex = lines.findIndex((line) => line.includes('能力テキスト'));
  const effectLines: string[] = [];
  if (abilityIndex >= 0) {
    for (let index = abilityIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (SUPPORT_META_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
        break;
      }
      effectLines.push(line);
    }
  } else {
    for (const line of lines) {
      if (SUPPORT_META_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
        continue;
      }
      if (cardName && line === cardName.trim()) {
        continue;
      }
      effectLines.push(line);
    }
  }

  if (effectLines.length === 0) {
    return null;
  }
  const sections = [cardName?.trim() || '', '能力テキスト', ...effectLines].filter((line) => line.length > 0);
  return sections.join('\n');
};

const extractSupportEffectText = (effectJson?: string | null, cardName?: string): string | null => {
  if (!effectJson || !effectJson.trim()) {
    return null;
  }

  const textCandidates: string[] = [];
  try {
    const parsed = JSON.parse(effectJson) as Record<string, unknown>;
    const candidates = [
      parsed.rawEffect,
      parsed.rawText,
      parsed.description,
      parsed.effect,
      parsed.keyword,
      parsed.abilityText,
      parsed.text,
    ];
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim()) {
        textCandidates.push(value.trim());
      }
    }
  } catch {
    textCandidates.push(effectJson.trim());
  }

  if (textCandidates.length === 0) {
    textCandidates.push(effectJson.trim());
  }
  for (const candidate of textCandidates) {
    const sanitized = sanitizeSupportEffectText(candidate, cardName);
    if (sanitized) {
      return sanitized;
    }
  }
  return null;
};

const extractMemberEffectText = (detail: CardDetail): string | null => {
  const passive = detail.passiveEffectJson?.trim();
  if (!passive) {
    return null;
  }
  const lines: string[] = [];
  try {
    const parsed = JSON.parse(passive) as Record<string, unknown>;
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.trim()) {
        lines.push(`${key}：${value.trim()}`);
      }
    }
  } catch {
    lines.push(passive);
  }
  if (lines.length === 0) {
    return null;
  }
  return ['能力テキスト', ...lines].join('\n');
};

const resolveCheerColorLabel = (color: string): string => {
  const normalized = color.trim().toUpperCase();
  switch (normalized) {
    case 'RED':
    case '赤':
      return '紅エール';
    case 'BLUE':
    case '青':
      return '藍エール';
    case 'YELLOW':
    case '黄':
      return '黃エール';
    case 'GREEN':
    case '緑':
      return '綠エール';
    case 'PURPLE':
    case '紫':
      return '紫エール';
    case 'WHITE':
    case '白':
      return '白エール';
    default:
      return `${normalized}エール`;
  }
};

const resolveCandidateMetaLines = (candidate: PendingDecisionCandidate): string[] => {
  const lines: string[] = [];
  if (candidate.maxHp != null) {
    const resolvedCurrentHp =
      candidate.currentHp != null
        ? candidate.currentHp
        : Math.max(candidate.maxHp - (candidate.damageTaken ?? 0), 0);
    lines.push(`HP ${resolvedCurrentHp}/${candidate.maxHp}`);
  }
  const colorCounts = candidate.cheerColorCounts ?? {};
  const colorLines = Object.entries(colorCounts)
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .sort(([a], [b]) => resolveCheerColorLabel(a).localeCompare(resolveCheerColorLabel(b), 'zh-Hant'))
    .map(([color, count]) => `${resolveCheerColorLabel(color)} *${count}`);
  if (colorLines.length > 0) {
    lines.push(...colorLines);
  } else if ((candidate.cheerCount ?? 0) > 0) {
    lines.push(`エール *${candidate.cheerCount}`);
  }
  return lines;
};

const resolveStageZoneLabel = (zone?: string): string => {
  switch ((zone ?? '').toUpperCase()) {
    case 'CENTER':
      return 'CENTER';
    case 'COLLAB':
      return 'COLLAB';
    case 'BACK':
      return 'BACK';
    default:
      return zone ?? '-';
  }
};

const levelRank = (level?: string | null): number => {
  switch ((level ?? '').toUpperCase()) {
    case 'DEBUT':
      return 0;
    case 'FIRST':
      return 1;
    case 'SECOND':
      return 2;
    default:
      return -1;
  }
};

// GameRoom 畫面：進入對戰後聚焦場地與視覺化操作
export const GameRoomScreen: FC<GameRoomScreenProps> = ({
  currentMatch,
  currentGameState,
  wsStatus,
  myDisplayName,
  opponentDisplayName,
  currentUserId,
  busy,
  onPlayToStage,
  onPlaySupport,
  onBloom,
  onAttachCheer,
  onAttackArt,
  onDrawTurn,
  onSendTurnCheer,
  onMoveStageHolomem,
  onResolveDecision,
  onEndTurn,
  onBackToLobby,
}) => {
  const isMyTurn = currentUserId != null && currentMatch.currentTurnPlayerId === currentUserId;
  const myState = useMemo(
    () => currentGameState?.players.find((player) => player.userId === currentUserId) ?? null,
    [currentGameState?.players, currentUserId],
  );
  const opponentState = useMemo(
    () =>
      currentGameState?.players.find((player) => currentUserId != null && player.userId !== currentUserId) ?? null,
    [currentGameState?.players, currentUserId],
  );

  const myHandCards = myState?.handCards ?? [];
  const myBoardZones = myState?.boardZones ?? [];
  const opponentBoardZones = opponentState?.boardZones ?? [];

  const myHolomems = useMemo(() => {
    return myBoardZones
      .filter((zone) => zone.zone === 'CENTER' || zone.zone === 'COLLAB' || zone.zone === 'BACK')
      .flatMap((zone) => zone.cards);
  }, [myBoardZones]);

  const myCenterHolomems = useMemo(() => {
    return myBoardZones.find((zone) => zone.zone === 'CENTER')?.cards ?? [];
  }, [myBoardZones]);

  const opponentTargets = useMemo(() => {
    return opponentBoardZones
      .filter((zone) => zone.zone === 'CENTER' || zone.zone === 'COLLAB' || zone.zone === 'BACK')
      .flatMap((zone) => zone.cards);
  }, [opponentBoardZones]);

  const pendingDecisions = currentGameState?.pendingDecisions ?? [];
  const activePendingDecision: PendingDecision | null = pendingDecisions[0] ?? null;
  const pendingInteractions = currentGameState?.pendingInteractions ?? [];
  const activePendingInteraction: PendingInteraction | null = pendingInteractions[0] ?? null;

  const allKnownCards = useMemo(() => {
    return [
      ...myHandCards,
      ...myBoardZones.flatMap((zone) => zone.cards),
      ...opponentBoardZones.flatMap((zone) => zone.cards),
    ];
  }, [myHandCards, myBoardZones, opponentBoardZones]);

  const uniqueCardIds = useMemo(() => {
    const cardIds = allKnownCards
      .map((card) => card.cardId)
      .filter((cardId): cardId is string => Boolean(cardId));
    const pendingCardIds = pendingDecisions
      .flatMap((decision) => decision.candidates)
      .map((candidate) => candidate.cardId)
      .filter((cardId): cardId is string => Boolean(cardId));
    const pendingInteractionCardIds = pendingInteractions
      .flatMap((interaction) => interaction.cards)
      .map((candidate) => candidate.cardId)
      .filter((cardId): cardId is string => Boolean(cardId));
    return Array.from(new Set([...cardIds, ...pendingCardIds, ...pendingInteractionCardIds]));
  }, [allKnownCards, pendingDecisions, pendingInteractions]);

  const [cardInfoById, setCardInfoById] = useState<Record<string, CardVisualExt>>({});
  const loadingCardIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const missingCardIds = uniqueCardIds.filter(
      (cardId) => !cardInfoById[cardId] && !loadingCardIdsRef.current.has(cardId),
    );
    if (missingCardIds.length === 0) {
      return;
    }

    for (const cardId of missingCardIds) {
      loadingCardIdsRef.current.add(cardId);
    }

    let cancelled = false;
    void Promise.all(
      missingCardIds.map(async (cardId) => {
        try {
          const detail = await getCardDetail(cardId);
          const preferredVariantImage =
            detail.variants.find((variant) => variant.isDefault)?.imageUrl ?? detail.variants[0]?.imageUrl ?? null;
          return [
            cardId,
            {
              name: detail.name || '卡片',
              imageUrl: detail.imageUrl ?? preferredVariantImage,
              cardType: detail.cardType,
              supportEffectText: extractSupportEffectText(detail.supportEffectJson, detail.name),
              memberEffectText: extractMemberEffectText(detail),
              levelType: detail.levelType ?? null,
            } satisfies CardVisualExt,
          ] as const;
        } catch {
          return [
            cardId,
            {
              name: '未收錄卡片',
              imageUrl: null,
              cardType: 'UNKNOWN',
            } satisfies CardVisualExt,
          ] as const;
        }
      }),
    )
      .then((entries) => {
        if (cancelled) {
          return;
        }
        setCardInfoById((previous) => {
          const next = { ...previous };
          for (const [cardId, info] of entries) {
            next[cardId] = info;
          }
          return next;
        });
      })
      .finally(() => {
        for (const cardId of missingCardIds) {
          loadingCardIdsRef.current.delete(cardId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [uniqueCardIds, cardInfoById]);

  const [attackerCardInstanceId, setAttackerCardInstanceId] = useState<number | null>(null);
  const [attackTargetCardInstanceId, setAttackTargetCardInstanceId] = useState<number | null>(null);
  const [pendingHandAction, setPendingHandAction] = useState<HandActionDraft | null>(null);
  const [pendingStageMove, setPendingStageMove] = useState<StageMoveDraft | null>(null);
  const [infoModalMessage, setInfoModalMessage] = useState<string | null>(null);
  const [selectedDecisionCardInstanceIds, setSelectedDecisionCardInstanceIds] = useState<number[]>([]);
  const [selectedInteractionCardInstanceIds, setSelectedInteractionCardInstanceIds] = useState<number[]>([]);

  useEffect(() => {
    setSelectedDecisionCardInstanceIds([]);
  }, [activePendingDecision?.decisionId]);

  useEffect(() => {
    setSelectedInteractionCardInstanceIds([]);
  }, [activePendingInteraction?.interactionId]);

  useEffect(() => {
    if (!myCenterHolomems.some((card) => card.cardInstanceId === attackerCardInstanceId)) {
      setAttackerCardInstanceId(myCenterHolomems[0]?.cardInstanceId ?? null);
    }
  }, [attackerCardInstanceId, myCenterHolomems]);

  useEffect(() => {
    if (!opponentTargets.some((card) => card.cardInstanceId === attackTargetCardInstanceId)) {
      setAttackTargetCardInstanceId(opponentTargets[0]?.cardInstanceId ?? null);
    }
  }, [attackTargetCardInstanceId, opponentTargets]);

  const recentActions = currentGameState?.recentActions ?? [];

  const canSubmitAction =
    !busy &&
    isMyTurn &&
    currentGameState?.status === 'STARTED' &&
    !activePendingDecision &&
    !activePendingInteraction;

  const myCollabHolomems = useMemo(() => {
    return myBoardZones.find((zone) => zone.zone === 'COLLAB')?.cards ?? [];
  }, [myBoardZones]);

  const myTurnActions = useMemo(() => {
    if (currentUserId == null || !currentGameState?.turnNumber) {
      return [];
    }
    return recentActions.filter(
      (action) => action.userId === currentUserId && action.turnNumber === currentGameState.turnNumber,
    );
  }, [recentActions, currentUserId, currentGameState?.turnNumber]);
  const hasUsedTurnDraw = useMemo(() => myTurnActions.some((action) => action.actionType === 'DRAW_TURN'), [myTurnActions]);
  const hasUsedTurnCheer = useMemo(
    () => myTurnActions.some((action) => action.actionType === 'TURN_CHEER'),
    [myTurnActions],
  );

  const cardName = (card: ZoneCardInstance): string => {
    return cardInfoById[card.cardId]?.name ?? '卡片';
  };

  const cardType = (card: ZoneCardInstance): string => {
    return cardInfoById[card.cardId]?.cardType ?? '';
  };

  const cardTypeLabel = (value: string): string => {
    switch (value) {
      case 'MEMBER':
        return 'Holomen';
      case 'SUPPORT':
        return 'Support';
      case 'CHEER':
        return 'Cheer';
      case 'OSHI':
        return 'Oshi';
      default:
        return value || '卡片';
    }
  };

  const resolveDefaultHandAction = (card: ZoneCardInstance): HandActionKind | null => {
    const type = cardType(card);
    if (type === 'MEMBER') {
      const level = (cardInfoById[card.cardId]?.levelType ?? '').toUpperCase();
      if (level === 'FIRST' || level === 'SECOND') {
        return 'BLOOM';
      }
      if (level === 'DEBUT' || level === 'SPOT' || level === 'BUZZ') {
        return 'PLAY_TO_STAGE';
      }
      return null;
    }
    if (type === 'SUPPORT') {
      return 'PLAY_SUPPORT';
    }
    if (type === 'CHEER') {
      return 'ATTACH_CHEER';
    }
    return null;
  };

  const resolveBloomTargets = (bloomCard: ZoneCardInstance): ZoneCardInstance[] => {
    const bloomInfo = cardInfoById[bloomCard.cardId];
    const bloomName = (bloomInfo?.name ?? '').trim();
    const bloomLevel = bloomInfo?.levelType;
    if (!bloomName || !bloomLevel) {
      return [];
    }
    const bloomRank = levelRank(bloomLevel);
    if (bloomRank <= 0) {
      return [];
    }
    return myHolomems.filter((target) => {
      const targetInfo = cardInfoById[target.cardId];
      const targetName = (targetInfo?.name ?? '').trim();
      const targetLevel = targetInfo?.levelType;
      if (!targetName || !targetLevel) {
        return false;
      }
      return targetName === bloomName && levelRank(targetLevel) >= 0 && levelRank(targetLevel) < bloomRank;
    });
  };

  const openHandAction = (card: ZoneCardInstance) => {
    const defaultKind = resolveDefaultHandAction(card);
    if (!defaultKind) {
      return;
    }

    const bloomTargets = defaultKind === 'BLOOM' ? resolveBloomTargets(card) : [];
    if (defaultKind === 'BLOOM' && bloomTargets.length === 0) {
      setInfoModalMessage('目前沒有可執行 BLOOM 的對象。');
      return;
    }

    setPendingHandAction({
      card,
      kind: defaultKind,
      targetZone: 'BACK',
      targetHolomemCardInstanceId:
        defaultKind === 'ATTACH_CHEER'
          ? (myHolomems[0]?.cardInstanceId ?? null)
          : defaultKind === 'BLOOM'
            ? (bloomTargets[0]?.cardInstanceId ?? null)
            : null,
    });
  };

  const supportTargetOptions = useMemo(() => {
    return [
      ...myHolomems.map((card) => ({
        cardInstanceId: card.cardInstanceId,
        label: `我方 ${cardName(card)} (${card.zone})`,
      })),
      ...opponentTargets.map((card) => ({
        cardInstanceId: card.cardInstanceId,
        label: `對手 ${cardName(card)} (${card.zone})`,
      })),
    ];
  }, [myHolomems, opponentTargets, cardInfoById]);

  const summarizeCheerColors = (card: ZoneCardInstance): string => {
    const colorCounts = card.cheerColorCounts ?? {};
    const parts = Object.entries(colorCounts)
      .filter(([, count]) => typeof count === 'number' && count > 0)
      .sort(([a], [b]) => resolveCheerColorLabel(a).localeCompare(resolveCheerColorLabel(b), 'zh-Hant'))
      .map(([color, count]) => `${resolveCheerColorLabel(color)}*${count}`);
    if (parts.length > 0) {
      return parts.join(' / ');
    }
    const cheerCount = card.cheerCount ?? 0;
    return cheerCount > 0 ? `エール*${cheerCount}` : 'エール*0';
  };

  const formatBloomTargetLabel = (target: ZoneCardInstance): string => {
    const zoneLabel = resolveStageZoneLabel(target.zone);
    const hp =
      target.maxHp != null
        ? `${target.currentHp ?? Math.max(target.maxHp - (target.damageTaken ?? 0), 0)}/${target.maxHp}`
        : '-';
    const supportCount = target.attachedSupportCount ?? 0;
    return `${cardName(target)} [${zoneLabel}] HP ${hp} / ${summarizeCheerColors(target)} / 裝備*${supportCount}`;
  };

  const bloomTargetOptions = useMemo(() => {
    if (!pendingHandAction || pendingHandAction.kind !== 'BLOOM') {
      return [];
    }
    return resolveBloomTargets(pendingHandAction.card);
  }, [pendingHandAction, myHolomems, cardInfoById]);

  const confirmHandAction = async () => {
    if (!pendingHandAction || !canSubmitAction) {
      return;
    }

    if (pendingHandAction.kind === 'PLAY_TO_STAGE') {
      await onPlayToStage({
        cardInstanceId: pendingHandAction.card.cardInstanceId,
        targetZone: pendingHandAction.targetZone,
      });
      setPendingHandAction(null);
      return;
    }

    if (pendingHandAction.kind === 'PLAY_SUPPORT') {
      const payload: PlaySupportActionRequest = {
        cardInstanceId: pendingHandAction.card.cardInstanceId,
      };
      if (pendingHandAction.targetHolomemCardInstanceId != null) {
        payload.targetHolomemCardInstanceId = pendingHandAction.targetHolomemCardInstanceId;
      }
      await onPlaySupport(payload);
      setPendingHandAction(null);
      return;
    }

    if (pendingHandAction.kind === 'BLOOM') {
      if (pendingHandAction.targetHolomemCardInstanceId == null) {
        return;
      }
      await onBloom({
        bloomCardInstanceId: pendingHandAction.card.cardInstanceId,
        targetHolomemCardInstanceId: pendingHandAction.targetHolomemCardInstanceId,
      });
      setPendingHandAction(null);
      return;
    }

    if (pendingHandAction.kind === 'ATTACH_CHEER') {
      if (pendingHandAction.targetHolomemCardInstanceId == null) {
        return;
      }
      await onAttachCheer({
        cheerCardInstanceId: pendingHandAction.card.cardInstanceId,
        targetHolomemCardInstanceId: pendingHandAction.targetHolomemCardInstanceId,
      });
      setPendingHandAction(null);
    }
  };

  const handleMyZoneClick = async (zoneId: number) => {
    if (!canSubmitAction) {
      setInfoModalMessage('目前有待處理互動，請先完成確認。');
      return;
    }

    if (zoneId === 5) {
      if (hasUsedTurnDraw) {
        setInfoModalMessage('這回合你已經抽過卡了。');
        return;
      }
      await onDrawTurn();
      return;
    }

    if (zoneId === 8) {
      if (hasUsedTurnCheer) {
        setInfoModalMessage('這回合你已經發送過吶喊了。');
        return;
      }
      await onSendTurnCheer();
    }
  };

  const handleMyZoneCardClick = (zoneId: number, card: ZoneCardInstance) => {
    if (!canSubmitAction) {
      setInfoModalMessage('目前有待處理互動，請先完成確認。');
      return;
    }
    if (zoneId !== 4) {
      return;
    }
    if (cardType(card) !== 'MEMBER') {
      return;
    }

    const centerAvailable = myCenterHolomems.length === 0;
    const collabAvailable = myCollabHolomems.length === 0;
    setPendingStageMove({
      card,
      targetZone: centerAvailable ? 'CENTER' : 'COLLAB',
      movable: centerAvailable || collabAvailable,
      blockedReason: centerAvailable || collabAvailable ? null : 'CENTER 與 COLLAB 都已有 Holomem，目前僅可查看卡片效果。',
    });
  };

  const confirmStageMove = async () => {
    if (!pendingStageMove || !canSubmitAction || !pendingStageMove.movable) {
      return;
    }
    await onMoveStageHolomem({
      cardInstanceId: pendingStageMove.card.cardInstanceId,
      targetZone: pendingStageMove.targetZone,
    });
    setPendingStageMove(null);
  };

  const actionTitle = (kind: HandActionKind): string => {
    switch (kind) {
      case 'PLAY_TO_STAGE':
        return '放置到場上';
      case 'PLAY_SUPPORT':
        return '發動 Support 效果';
      case 'ATTACH_CHEER':
        return '附加 Cheer';
      case 'BLOOM':
        return '執行 BLOOM';
      default:
        return kind;
    }
  };

  const canConfirmHandAction =
    !!pendingHandAction &&
    canSubmitAction &&
    (
      (pendingHandAction.kind !== 'ATTACH_CHEER' && pendingHandAction.kind !== 'BLOOM') ||
      pendingHandAction.targetHolomemCardInstanceId != null
    );

  const canPerformTurnCheer = useMemo(() => {
    const hasCheerInDeck = (myState?.cheerDeckCount ?? 0) > 0;
    const hasHolomemOnStage = myHolomems.length > 0;
    return hasCheerInDeck && hasHolomemOnStage;
  }, [myState?.cheerDeckCount, myHolomems.length]);

  const handleEndTurnClick = async () => {
    if (busy || !isMyTurn) {
      return;
    }
    const missing: string[] = [];
    if (!hasUsedTurnDraw) {
      missing.push('抽卡');
    }
    if (canPerformTurnCheer && !hasUsedTurnCheer) {
      missing.push('發送吶喊');
    }
    if (missing.length > 0) {
      setInfoModalMessage(`回合尚未完成：${missing.join('、')}。請先完成後再結束回合。`);
      return;
    }
    await onEndTurn();
  };

  const toggleDecisionSelection = (cardInstanceId: number) => {
    if (!activePendingDecision || busy) {
      return;
    }
    setSelectedDecisionCardInstanceIds((previous) => {
      const exists = previous.includes(cardInstanceId);
      if (exists) {
        return previous.filter((value) => value !== cardInstanceId);
      }
      if (previous.length >= activePendingDecision.maxSelect) {
        return previous;
      }
      return [...previous, cardInstanceId];
    });
  };

  const canResolveDecision =
    !!activePendingDecision &&
    !busy &&
    selectedDecisionCardInstanceIds.length >= Math.max(activePendingDecision.minSelect, 1) &&
    selectedDecisionCardInstanceIds.length <= activePendingDecision.maxSelect;

  const toggleInteractionSelection = (cardInstanceId: number) => {
    if (!activePendingInteraction || busy) {
      return;
    }
    if (activePendingInteraction.interactionType !== 'SEND_CHEER') {
      return;
    }
    setSelectedInteractionCardInstanceIds((previous) => {
      const exists = previous.includes(cardInstanceId);
      if (exists) {
        return previous.filter((value) => value !== cardInstanceId);
      }
      if (previous.length >= activePendingInteraction.maxSelect) {
        return previous;
      }
      return [...previous, cardInstanceId];
    });
  };

  const canConfirmInteraction = useMemo(() => {
    if (!activePendingInteraction || busy) {
      return false;
    }
    if (activePendingInteraction.interactionType === 'TURN_START') {
      return true;
    }
    if (activePendingInteraction.interactionType === 'DRAW_REVEAL') {
      return true;
    }
    if (activePendingInteraction.interactionType === 'SEND_CHEER') {
      return (
        selectedInteractionCardInstanceIds.length >= Math.max(activePendingInteraction.minSelect, 1) &&
        selectedInteractionCardInstanceIds.length <= activePendingInteraction.maxSelect
      );
    }
    return false;
  }, [activePendingInteraction, busy, selectedInteractionCardInstanceIds]);

  const actionActorLabel = (action: RecentMatchAction): string => {
    if (currentUserId == null) {
      return `玩家 #${action.userId}`;
    }
    return action.userId === currentUserId ? '我方' : '對手';
  };

  const resolveBloomSummary = (action: RecentMatchAction): BloomActionSummary | null => {
    if (action.actionType !== 'BLOOM') {
      return null;
    }
    const payload = asRecord(action.payload);
    const bloomEffect = asRecord(payload?.bloomEffect);
    if (!bloomEffect) {
      return null;
    }
    return {
      diceRoll: asNumber(bloomEffect.diceRoll),
      requestedEffects: asStringList(bloomEffect.requestedEffects),
      executedEffects: asEffectTypeList(bloomEffect.executedEffects),
      unsupportedEffects: asStringList(bloomEffect.unsupportedEffects),
    };
  };

  return (
    <>
      <div className="screen-header">
        <div>
          <h1>Game Room</h1>
          <p>
            Match #{currentMatch.matchId} / Room: <strong>{currentMatch.roomCode}</strong> / Status:{' '}
            <strong>{currentMatch.status}</strong>
          </p>
          <p>
            Turn #{currentMatch.turnNumber} / Current Player: #{currentMatch.currentTurnPlayerId ?? '-'}
          </p>
          <p>Phase: {currentGameState?.phase ?? 'RESET'}</p>
          <p>WebSocket: {wsStatus}</p>
        </div>

        <div className="screen-header__actions">
          <button type="button" onClick={() => void handleEndTurnClick()} disabled={busy || !isMyTurn}>
            End Turn
          </button>
          <button type="button" onClick={onBackToLobby}>
            回到 Lobby
          </button>
        </div>
      </div>

      <BattlefieldPanel
        showBattlefield={true}
        myDisplayName={myDisplayName}
        opponentDisplayName={opponentDisplayName}
        currentUserId={currentUserId}
        gameState={currentGameState}
        cardInfoById={cardInfoById}
        onMyZoneClick={(zoneId) => {
          void handleMyZoneClick(zoneId);
        }}
        onMyZoneCardClick={handleMyZoneCardClick}
      />

      <section className="panel battle-ops-panel">
        <h2>手牌與操作</h2>
        {activePendingInteraction ? (
          <p className="battle-ops-panel__hint">目前有待確認互動，請先完成彈窗確認。</p>
        ) : null}
        {activePendingDecision ? (
          <p className="battle-ops-panel__hint">目前有待處理效果，請先完成下方「效果選擇」。</p>
        ) : null}

        <div className="hand-rack">
          {myHandCards.length === 0 ? <p className="hand-rack__empty">目前沒有手牌。</p> : null}
          {myHandCards.map((card) => {
            const info = cardInfoById[card.cardId];
            const type = cardType(card);
            const defaultAction = resolveDefaultHandAction(card);
            const disabled = !canSubmitAction || defaultAction == null;

            return (
              <button
                key={card.cardInstanceId}
                type="button"
                className="hand-card"
                disabled={disabled}
                onClick={() => openHandAction(card)}
                title={disabled ? '目前不可操作' : '點擊執行操作'}
              >
                {info?.imageUrl ? (
                  <img className="card-visual card-visual--front" src={info.imageUrl} alt={info.name} loading="lazy" />
                ) : (
                  <div className="card-visual card-visual--placeholder">
                    <span>{info?.name ?? card.cardId}</span>
                  </div>
                )}
                <span className="hand-card__name">{info?.name ?? '載入中'}</span>
                <span className="hand-card__meta">{cardTypeLabel(type)}</span>
              </button>
            );
          })}
        </div>

        <div className="battle-ops-panel__attack">
          <h3>攻擊操作</h3>
          <div className="battle-ops-panel__attack-grid">
            <label>
              攻擊者（CENTER）
              <select
                value={attackerCardInstanceId ?? ''}
                onChange={(event) => setAttackerCardInstanceId(event.target.value ? Number(event.target.value) : null)}
              >
                <option value="">選擇攻擊者</option>
                {myCenterHolomems.map((card) => (
                  <option key={card.cardInstanceId} value={card.cardInstanceId}>
                    {cardName(card)} ({card.zone})
                  </option>
                ))}
              </select>
            </label>

            <label>
              目標（可選）
              <select
                value={attackTargetCardInstanceId ?? ''}
                onChange={(event) =>
                  setAttackTargetCardInstanceId(event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">不指定目標</option>
                {opponentTargets.map((card) => (
                  <option key={card.cardInstanceId} value={card.cardInstanceId}>
                    {cardName(card)} ({card.zone})
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              disabled={!canSubmitAction || attackerCardInstanceId == null}
              onClick={() => {
                if (attackerCardInstanceId == null) {
                  return;
                }
                void onAttackArt({
                  attackerCardInstanceId,
                  targetCardInstanceId: attackTargetCardInstanceId,
                });
              }}
            >
              攻擊
            </button>
          </div>
        </div>
      </section>

      {activePendingDecision ? (
        <section className="panel battle-decision-panel">
          <h2>效果選擇</h2>
          <p>
            類型：{activePendingDecision.effectType} / 請選擇 {activePendingDecision.minSelect} ~{' '}
            {activePendingDecision.maxSelect} 張
          </p>
          <div className="battle-decision-panel__candidates">
            {activePendingDecision.candidates.map((candidate) => {
              const selected = selectedDecisionCardInstanceIds.includes(candidate.cardInstanceId);
              const info = cardInfoById[candidate.cardId];
              const metaLines = resolveCandidateMetaLines(candidate);
              return (
                <button
                  key={candidate.cardInstanceId}
                  type="button"
                  className={`battle-decision-card${selected ? ' is-selected' : ''}`}
                  onClick={() => toggleDecisionSelection(candidate.cardInstanceId)}
                >
                  {info?.imageUrl ? (
                    <img
                      className="card-visual card-visual--front"
                      src={info.imageUrl}
                      alt={info.name ?? candidate.name ?? candidate.cardId}
                      loading="lazy"
                    />
                  ) : (
                    <div className="card-visual card-visual--placeholder">
                      <span>{candidate.name ?? candidate.cardId}</span>
                    </div>
                  )}
                  <span className="hand-card__name">{candidate.name ?? info?.name ?? candidate.cardId}</span>
                  {metaLines.length > 0 ? (
                    <span className="battle-candidate-meta">
                      {metaLines.map((line) => (
                        <span key={`${candidate.cardInstanceId}-${line}`} className="battle-candidate-meta__line">
                          {line}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="hand-card__meta">可選目標</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="battle-decision-panel__actions">
            <button
              type="button"
              disabled={!canResolveDecision}
              onClick={() =>
                void onResolveDecision({
                  decisionId: activePendingDecision.decisionId,
                  selectedCardInstanceIds: selectedDecisionCardInstanceIds,
                })
              }
            >
              確認結算效果
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel battle-log-panel">
        <h2>最近行動</h2>
        {recentActions.length === 0 ? (
          <p className="battle-log-panel__empty">尚無行動紀錄。</p>
        ) : (
          <ul className="battle-log-list">
            {recentActions.map((action) => {
              const bloomSummary = resolveBloomSummary(action);
              return (
                <li key={action.actionId} className="battle-log-item">
                  <div className="battle-log-item__header">
                    <strong>{action.actionType}</strong>
                    <span>
                      T{action.turnNumber}-{action.actionOrder} {actionActorLabel(action)}
                    </span>
                  </div>

                  {bloomSummary ? (
                    <div className="battle-log-item__detail">
                      {bloomSummary.diceRoll != null ? <p>骰值：{bloomSummary.diceRoll}</p> : null}
                      <p>
                        請求效果：
                        {bloomSummary.requestedEffects.length > 0 ? bloomSummary.requestedEffects.join(', ') : '無'}
                      </p>
                      <p>
                        實際執行：
                        {bloomSummary.executedEffects.length > 0 ? bloomSummary.executedEffects.join(', ') : '無'}
                      </p>
                      {bloomSummary.unsupportedEffects.length > 0 ? (
                        <p>未支援：{bloomSummary.unsupportedEffects.join(', ')}</p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {pendingHandAction ? (
        <section className="battle-action-modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="battle-action-modal__backdrop"
            aria-label="關閉"
            onClick={() => setPendingHandAction(null)}
          />
          <div className="battle-action-modal__panel">
            <h3>{actionTitle(pendingHandAction.kind)}</h3>
            <p>確認是否執行這張卡片的操作？</p>

            <div className="battle-action-modal__card">
              {cardInfoById[pendingHandAction.card.cardId]?.imageUrl ? (
                <img
                  className="card-visual card-visual--front"
                  src={cardInfoById[pendingHandAction.card.cardId]?.imageUrl ?? ''}
                  alt={cardName(pendingHandAction.card)}
                />
              ) : (
                <div className="card-visual card-visual--placeholder">
                  <span>{cardName(pendingHandAction.card)}</span>
                </div>
              )}
              <div>
                <strong>{cardName(pendingHandAction.card)}</strong>
                <p>{cardTypeLabel(cardType(pendingHandAction.card))}</p>
              </div>
            </div>

            {pendingHandAction.kind === 'PLAY_TO_STAGE' ? (
              <div className="battle-action-modal__controls">
                <p>此操作會先將 Holomen 放置到 BACK（區塊 4）。</p>
              </div>
            ) : null}

            {pendingHandAction.kind === 'BLOOM' ? (
              <div className="battle-action-modal__controls">
                {cardInfoById[pendingHandAction.card.cardId]?.memberEffectText ? (
                  <p className="battle-action-modal__effect">{cardInfoById[pendingHandAction.card.cardId]?.memberEffectText}</p>
                ) : null}
                <label>
                  BLOOM 目標
                  <select
                    value={pendingHandAction.targetHolomemCardInstanceId ?? ''}
                    onChange={(event) =>
                      setPendingHandAction((previous) => {
                        if (!previous) {
                          return previous;
                        }
                        return {
                          ...previous,
                          targetHolomemCardInstanceId: event.target.value ? Number(event.target.value) : null,
                        };
                      })
                    }
                  >
                    <option value="">選擇要 BLOOM 的 Holomem</option>
                    {bloomTargetOptions.map((target) => (
                      <option key={target.cardInstanceId} value={target.cardInstanceId}>
                        {formatBloomTargetLabel(target)}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="battle-action-modal__effect">BLOOM 後會繼承目標目前附加的エール與裝備狀態。</p>
              </div>
            ) : null}

            {pendingHandAction.kind === 'ATTACH_CHEER' ? (
              <div className="battle-action-modal__controls">
                <label>
                  附加目標
                  <select
                    value={pendingHandAction.targetHolomemCardInstanceId ?? ''}
                    onChange={(event) =>
                      setPendingHandAction((previous) => {
                        if (!previous) {
                          return previous;
                        }
                        return {
                          ...previous,
                          targetHolomemCardInstanceId: event.target.value ? Number(event.target.value) : null,
                        };
                      })
                    }
                  >
                    <option value="">選擇我方 Holomen</option>
                    {myHolomems.map((card) => (
                      <option key={card.cardInstanceId} value={card.cardInstanceId}>
                        {cardName(card)} ({card.zone})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {pendingHandAction.kind === 'PLAY_SUPPORT' ? (
              <div className="battle-action-modal__controls">
                {cardInfoById[pendingHandAction.card.cardId]?.supportEffectText ? (
                  <p className="battle-action-modal__effect">{cardInfoById[pendingHandAction.card.cardId]?.supportEffectText}</p>
                ) : null}
                <label>
                  目標 Holomen（可選）
                  <select
                    value={pendingHandAction.targetHolomemCardInstanceId ?? ''}
                    onChange={(event) =>
                      setPendingHandAction((previous) => {
                        if (!previous) {
                          return previous;
                        }
                        return {
                          ...previous,
                          targetHolomemCardInstanceId: event.target.value ? Number(event.target.value) : null,
                        };
                      })
                    }
                  >
                    <option value="">不指定目標</option>
                    {supportTargetOptions.map((target) => (
                      <option key={target.cardInstanceId} value={target.cardInstanceId}>
                        {target.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <div className="battle-action-modal__actions">
              <button type="button" onClick={() => setPendingHandAction(null)}>
                取消
              </button>
              <button type="button" disabled={!canConfirmHandAction} onClick={() => void confirmHandAction()}>
                確認執行
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {pendingStageMove ? (
        <section className="battle-action-modal" role="dialog" aria-modal="true">
          <button type="button" className="battle-action-modal__backdrop" aria-label="移動 Holomem 背景" />
          <div className="battle-action-modal__panel">
            <h3>移動場上 Holomen</h3>
            <p>{pendingStageMove.movable ? '選擇要移動到 CENTER 或 COLLAB。' : '目前無法移動，僅可查看卡片效果。'}</p>

            <div className="battle-action-modal__card">
              {cardInfoById[pendingStageMove.card.cardId]?.imageUrl ? (
                <img
                  className="card-visual card-visual--front"
                  src={cardInfoById[pendingStageMove.card.cardId]?.imageUrl ?? ''}
                  alt={cardName(pendingStageMove.card)}
                />
              ) : (
                <div className="card-visual card-visual--placeholder">
                  <span>{cardName(pendingStageMove.card)}</span>
                </div>
              )}
              <div>
                <strong>{cardName(pendingStageMove.card)}</strong>
                <p>{cardTypeLabel(cardType(pendingStageMove.card))}</p>
              </div>
            </div>

            {cardInfoById[pendingStageMove.card.cardId]?.memberEffectText ? (
              <p className="battle-action-modal__effect">{cardInfoById[pendingStageMove.card.cardId]?.memberEffectText}</p>
            ) : null}
            {pendingStageMove.blockedReason ? (
              <p className="battle-action-modal__effect">{pendingStageMove.blockedReason}</p>
            ) : null}

            <div className="battle-action-modal__controls">
              <label>
                目標區位
                <select
                  value={pendingStageMove.targetZone}
                  disabled={!pendingStageMove.movable}
                  onChange={(event) =>
                    setPendingStageMove((previous) => {
                      if (!previous) {
                        return previous;
                      }
                      const target = event.target.value === 'COLLAB' ? 'COLLAB' : 'CENTER';
                      return { ...previous, targetZone: target };
                    })
                  }
                >
                  {!pendingStageMove.movable ? (
                    <option value={pendingStageMove.targetZone}>{pendingStageMove.targetZone}</option>
                  ) : null}
                  {myCenterHolomems.length === 0 ? <option value="CENTER">CENTER</option> : null}
                  {myCollabHolomems.length === 0 ? <option value="COLLAB">COLLAB</option> : null}
                </select>
              </label>
            </div>

            <div className="battle-action-modal__actions">
              <button type="button" onClick={() => setPendingStageMove(null)}>
                取消
              </button>
              <button type="button" disabled={!canSubmitAction || !pendingStageMove.movable} onClick={() => void confirmStageMove()}>
                確認移動
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {infoModalMessage ? (
        <section className="battle-action-modal" role="dialog" aria-modal="true">
          <button type="button" className="battle-action-modal__backdrop" aria-label="提示背景" />
          <div className="battle-action-modal__panel">
            <h3>提示</h3>
            <p>{infoModalMessage}</p>
            <div className="battle-action-modal__actions">
              <button type="button" onClick={() => setInfoModalMessage(null)}>
                確認
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {activePendingInteraction ? (
        <section className="battle-action-modal" role="dialog" aria-modal="true">
          <button type="button" className="battle-action-modal__backdrop" aria-label="待確認互動背景" />
          <div className="battle-action-modal__panel">
            <h3>{activePendingInteraction.title ?? '待確認互動'}</h3>
            <p>{activePendingInteraction.message ?? '請確認後繼續。'}</p>

            <div className="battle-interaction-modal__cards">
              {activePendingInteraction.cards.map((card) => {
                const info = cardInfoById[card.cardId];
                const imageUrl = card.imageUrl ?? info?.imageUrl ?? null;
                const name = card.name ?? info?.name ?? card.cardId;
                const selectable = activePendingInteraction.interactionType === 'SEND_CHEER';
                const selected = selectedInteractionCardInstanceIds.includes(card.cardInstanceId);
                const metaLines = resolveCandidateMetaLines(card);
                const zoneLabel = resolveStageZoneLabel(card.zone);
                return (
                  <button
                    key={card.cardInstanceId}
                    type="button"
                    className={`battle-interaction-modal__card${selected ? ' is-selected' : ''}`}
                    disabled={!selectable || busy}
                    onClick={() => toggleInteractionSelection(card.cardInstanceId)}
                  >
                    {imageUrl ? (
                      <img className="card-visual card-visual--front" src={imageUrl} alt={name} loading="lazy" />
                    ) : (
                      <div className="card-visual card-visual--placeholder">
                        <span>{name}</span>
                      </div>
                    )}
                    <figcaption>{name}</figcaption>
                    <span className="battle-candidate-meta__line">區位：{zoneLabel}</span>
                    {metaLines.length > 0 ? (
                      <div className="battle-candidate-meta">
                        {metaLines.map((line) => (
                          <span key={`${card.cardInstanceId}-${line}`} className="battle-candidate-meta__line">
                            {line}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="battle-action-modal__actions">
              <button
                type="button"
                disabled={!canConfirmInteraction}
                onClick={() =>
                  void onResolveDecision({
                    decisionId: activePendingInteraction.interactionId,
                    selectedCardInstanceIds:
                      activePendingInteraction.interactionType === 'SEND_CHEER'
                        ? selectedInteractionCardInstanceIds
                        : [],
                  })
                }
              >
                確認
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
};
