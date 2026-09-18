import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { clearRateLimitsForTests, guardRequest, originAllowed } from "../request-guard";

const request=(origin:string|null,ip="1.2.3.4")=>new NextRequest("https://canvas.example/api/test",{method:"POST",headers:{...(origin?{origin}:{}),"x-forwarded-for":ip,"content-type":"application/json"},body:"{}"});
describe("request guard",()=>{
  it("allows same-origin and blocks untrusted origins",()=>{
    clearRateLimitsForTests();
    expect(originAllowed(request("https://canvas.example"))).toBe(true);
    expect(originAllowed(request("https://evil.example"))).toBe(false);
    expect(guardRequest(request("https://evil.example"),{scope:"test",maxRequests:5,windowMs:1000,requireTokenWithoutOrigin:true})).not.toBeNull();
  });
  it("rate limits a repeated client",()=>{
    clearRateLimitsForTests();
    const options={scope:"rate",maxRequests:2,windowMs:60_000};
    expect(guardRequest(request("https://canvas.example"),options)).toBeNull();
    expect(guardRequest(request("https://canvas.example"),options)).toBeNull();
    expect(guardRequest(request("https://canvas.example"),options)?.status).toBe(429);
  });
});
