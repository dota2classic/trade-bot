import * as SteamUser from 'steam-user';
import * as SteamCommunity from 'steamcommunity';
import * as TradeOfferManager from 'steam-tradeoffer-manager';

export class Steam {
  constructor(
    public readonly trade: TradeOfferManager,
    public readonly client: SteamUser,
    public readonly community: SteamCommunity,
  ) {}
}
