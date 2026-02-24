import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { BattlefieldPanel } from '../battlefield/BattlefieldPanel';
import { getCardDetail, type PlaySupportActionRequest } from '../../services/api';
import type {
  AttachCheerActionRequest,
  AttackArtActionRequest,
  GameState,
  LobbyMatch,
  PendingDecision,
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
  onAttachCheer: (payload: AttachCheerActionRequest) => Promise<void>;
  onAttackArt: (payload: AttackArtActionRequest) => Promise<void>;
  onResolveDecision: (payload: ResolveDecisionActionRequest) => Promise<void>;
  onEndTurn: () => Promise<void>;
  onBackToLobby: () => void;
}

type HandActionKind = 'PLAY_TO_STAGE' | 'PLAY_SUPPORT' | 'ATTACH_CHEER';

interface HandActionDraft {
  card: ZoneCardInstance;
  kind: HandActionKind;
  targetZone: 'CENTER' | 'BACK';
  targetHolomemCardInstanceId: number | null;
}

interface CardVisualExt extends ZoneCardVisualInfo {
  cardType: string;
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
  onAttachCheer,
  onAttackArt,
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
    return Array.from(new Set([...cardIds, ...pendingCardIds]));
  }, [allKnownCards, pendingDecisions]);

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
  const [selectedDecisionCardInstanceIds, setSelectedDecisionCardInstanceIds] = useState<number[]>([]);

  useEffect(() => {
    setSelectedDecisionCardInstanceIds([]);
  }, [activePendingDecision?.decisionId]);

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

  const canSubmitAction = !busy && isMyTurn && currentGameState?.status === 'STARTED' && !activePendingDecision;

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
      return 'PLAY_TO_STAGE';
    }
    if (type === 'SUPPORT') {
      return 'PLAY_SUPPORT';
    }
    if (type === 'CHEER') {
      return 'ATTACH_CHEER';
    }
    return null;
  };

  const openHandAction = (card: ZoneCardInstance) => {
    const defaultKind = resolveDefaultHandAction(card);
    if (!defaultKind) {
      return;
    }

    setPendingHandAction({
      card,
      kind: defaultKind,
      targetZone: 'CENTER',
      targetHolomemCardInstanceId: defaultKind === 'ATTACH_CHEER' ? (myHolomems[0]?.cardInstanceId ?? null) : null,
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

  const actionTitle = (kind: HandActionKind): string => {
    switch (kind) {
      case 'PLAY_TO_STAGE':
        return '放置到場上';
      case 'PLAY_SUPPORT':
        return '發動 Support 效果';
      case 'ATTACH_CHEER':
        return '附加 Cheer';
      default:
        return kind;
    }
  };

  const canConfirmHandAction =
    !!pendingHandAction &&
    canSubmitAction &&
    (pendingHandAction.kind !== 'ATTACH_CHEER' || pendingHandAction.targetHolomemCardInstanceId != null);

  const recentActions = currentGameState?.recentActions ?? [];

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
          <button type="button" onClick={() => void onEndTurn()} disabled={busy || !isMyTurn}>
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
      />

      <section className="panel battle-ops-panel">
        <h2>手牌與操作</h2>
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
                  <span className="hand-card__meta">#{candidate.cardInstanceId}</span>
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
                <label>
                  目標區位
                  <select
                    value={pendingHandAction.targetZone}
                    onChange={(event) =>
                      setPendingHandAction((previous) => {
                        if (!previous) {
                          return previous;
                        }
                        return {
                          ...previous,
                          targetZone: event.target.value === 'BACK' ? 'BACK' : 'CENTER',
                        };
                      })
                    }
                  >
                    <option value="CENTER">CENTER</option>
                    <option value="BACK">BACK</option>
                  </select>
                </label>
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
    </>
  );
};
