import SteamCommunity from 'steamcommunity';
import { CookieJar } from 'request';

export function getCookie(community: SteamCommunity, name: string) {
  const jar = community['_jar'] as CookieJar;
  return jar
    .getCookies('https://steamcommunity.com')
    .find((t) => t.key === name)?.value;
}
