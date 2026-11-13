import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
vi.mock("next-auth/jwt",()=>({getToken:vi.fn()}));
import {getToken} from "next-auth/jwt";
import {middleware} from "@/middleware";
const token=vi.mocked(getToken);
const request=(path:string)=>new NextRequest(new URL(path,"http://localhost"));
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("NODE_ENV","production");token.mockResolvedValue(null);});
afterEach(()=>{vi.unstubAllEnvs();});
describe("production preview concealment before generic authentication",()=>{
  it.each([undefined,"0","true","yes",""])("returns a private 404 with flag %s before reading a token",async value=>{
    vi.stubEnv("V4_LEARNING_PREVIEW_ENABLED",value);
    for(const path of ["/learn/day","/learn/preview","/learn/preview/factory@4.0.0-draft.6@g7-civics-counties-capitals","/api/student/learning-preview","/api/student/learning-preview/not-allowlisted"]){
      const res=await middleware(request(path));
      expect(res.status).toBe(404);
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(res.headers.get("content-security-policy")).toContain("default-src");
    }
    expect(token).not.toHaveBeenCalled();
  });
  it("retains authentication when explicitly enabled",async()=>{
    vi.stubEnv("V4_LEARNING_PREVIEW_ENABLED","1");
    const page=await middleware(request("/learn/preview/not-allowlisted"));
    expect(page.status).toBe(307);expect(page.headers.get("location")).toContain("/login");
    expect((await middleware(request("/api/student/learning-preview/not-allowlisted"))).status).toBe(401);
    expect(token).toHaveBeenCalledTimes(2);
  });
  it("keeps /learn/day authentication when explicitly enabled",async()=>{
    vi.stubEnv("V4_LEARNING_PREVIEW_ENABLED","1");
    const res=await middleware(request("/learn/day"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    expect(new URL(res.headers.get("location")!).searchParams.get("next")).toBe("/learn/day");
    expect(token).toHaveBeenCalledOnce();
  });
  it("leaves official delivery and similar non-preview paths under their existing auth policy",async()=>{
    vi.stubEnv("V4_LEARNING_PREVIEW_ENABLED","0");
    for(const path of ["/student/lessons/existing","/learn/day-other","/learn/preview-other","/api/student/learning-preview-other"]){
      const res=await middleware(request(path));
      expect(res.status).toBe(path.startsWith("/api/")?401:307);
    }
    expect(token).toHaveBeenCalledTimes(4);
  });
});
