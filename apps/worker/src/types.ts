export type TradingMode = 'paper' | 'live' | 'paused';
export type Aggressiveness = 'conservative' | 'balanced' | 'aggressive';
export type Asset = 'ETH-USD' | 'IOTX-USD';

export interface Env {
  DB: D1Database;
  BOT_DO: DurableObjectNamespace<BotDurableObject>;
  JWT_SECRET: string;
  APP_ADMIN_USER: string;
  APP_ADMIN_PASSWORD: string;
  COINBASE_API_KEY: string;
  COINBASE_API_SECRET: string;
  COINBASE_PASSPHRASE: string;
  DEFAULT_ASSET: string;
  TRADING_MODE: string;
  LIVE_TRADING_ENABLED: string;
}

export interface BotStatus {
  asset: Asset;
  mode: TradingMode;
  liveSwitchEnabled: boolean;
  killSwitchEnabled: boolean;
  regime: string;
  regimeConfidence: number;
  lastPrice: number;
  lastUpdated: string;
  commentary: {
    market: string;
    posture: string;
    decision: string;
    position: string;
    risk: string;
  };
  signalScore: number;
  entryEligible: boolean;
}

export declare class BotDurableObject extends DurableObject<Env> {}
