// korean-marathon-schedule 패키지는 타입 정의를 제공하지 않아, 우리가 쓰는 부분만 적어 둔다.
declare module "korean-marathon-schedule" {
  export type RawEvent = {
    title?: string;
    eventDate?: string;
    region?: string;
    venue?: string;
    registrationDeadline?: string;
    registrationPeriod?: { start?: string; end?: string };
    categories?: string[];
    officialUrl?: string;
    url?: string;
  };

  export function searchEvents(options: {
    query?: string;
    from?: string;
    to?: string;
    includeTriathlon?: boolean;
    limit?: number;
    maxDetailsPerSource?: number;
    fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
  }): Promise<{ warnings: string[]; items: RawEvent[] }>;
}
