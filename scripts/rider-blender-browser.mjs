import {chromium} from 'playwright';

// Keep the established Windows Edge path while allowing an explicit browser or
// Playwright's installed Chromium on CI. These checks still use software WebGL.
export const riderBrowserName=process.env.CHROMIUM_PATH?'CHROMIUM_PATH browser':process.platform==='win32'?'Edge':'Playwright Chromium (full browser headless)';

// Select the full browser on CI, matching the existing RAF integration check.
// Omitting channel selects chromium-headless-shell, unlike local Edge captures.
// Image quality, viewport, screenshot deadlines and assertions stay unchanged.
export function launchRiderBrowser(){
  const selection=process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:process.platform==='win32'?{channel:'msedge'}:{channel:'chromium'};
  return chromium.launch({...selection,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
}
