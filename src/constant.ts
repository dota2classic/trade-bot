export const DOTA_APPID = 570;

export const SUPPORTED_APP_IDS = [
  // 3015610, // Cucumber
  // 2977660, // Cats
  // 2784840, // Egg
  // 3050630, // Melon
  // 3070500, // Coin
  // 2923300, // Banana
  // 753, // Steam
  570, // Dota
  440, // TeamFortress
  730, // Counter strike
];

export enum Currency {
  USD = '1',
  POUND = '2',
  EURO = '3',
  RUB = '5',
}

export enum TradeOfferStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Escrow = 'escrow',
}

export enum ItemRarity {
  Common = 'Common',
  Rare = 'Rare',
  Uncommon = 'Uncommon',
  Mythical = 'Mythical',
  Immortal = 'Immortal',
  Legendary = 'Legendary',
  Arcana = 'Arcana',
  Ancient = 'Ancient',
}

export enum ItemQuality {
  Standard = 'Standard',
  Inscribed = 'Inscribed',
  Auspicious = 'Auspicious',
  Genuine = 'Genuine',
  Autographed = 'Autographed',
  Heroic = 'Heroic',
  Frozen = 'Frozen',
  Base = 'Base',
  Cursed = 'Cursed',
  Unusual = 'Unusual',
  Infused = 'Infused',
  Corrupted = 'Corrupted',
  Exalted = 'Exalted',
  Elder = 'Elder',
  Glitter = 'Glitter',
  Gold = 'Gold',
  Holo = 'Holo',
  Legacy = 'Legacy',
  Favored = 'Favored',
  Ascendant = 'Ascendant',
}
export const ItemQualities: ItemQuality[] = [
  ItemQuality.Standard,
  ItemQuality.Inscribed,
  ItemQuality.Auspicious,
  ItemQuality.Genuine,
  ItemQuality.Autographed,
  ItemQuality.Heroic,
  ItemQuality.Frozen,
  ItemQuality.Base,
  ItemQuality.Cursed,
  ItemQuality.Unusual,
  ItemQuality.Infused,
  ItemQuality.Corrupted,
  ItemQuality.Exalted,
  ItemQuality.Elder,
  ItemQuality.Glitter,
  ItemQuality.Gold,
  ItemQuality.Holo,
  ItemQuality.Legacy,
  ItemQuality.Favored,
  ItemQuality.Ascendant,
];

export enum ETradeOfferState {
  /* Invalid. */
  Invalid = 1,
  /* This trade offer has been sent, neither party has acted on it yet. */
  Active = 2,
  /* The trade offer was accepted by the recipient and items were exchanged. */
  Accepted = 3,
  /* The recipient made a counter offer */
  Countered = 4,
  /* The trade offer was not accepted before the expiration date */
  Expired = 5,
  /* The sender cancelled the offer */
  Canceled = 6,
  /* The recipient declined the offer */
  Declined = 7,
  /* Some of the items in the offer are no longer available (indicated by the missing flag in the output) */
  InvalidItems = 8,
  /* The offer hasn't been sent yet and is awaiting further confirmation */
  CreatedNeedsConfirmation = 9,
  /* Either party canceled the offer via email/mobile confirmation */
  CanceledBySecondFactor = 10,
  /* The trade has been placed on hold */
  InEscrow = 11,
}
