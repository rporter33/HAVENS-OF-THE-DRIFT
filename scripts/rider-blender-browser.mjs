import {chromium} from 'playwright';

// Keep the established Windows Edge path while allowing an explicit browser or
// Playwright's installed Chromium on CI. These checks still use software WebGL.
export const riderBrowserName=process.env.CHROMIUM_PATH?'CHROMIUM_PATH browser':process.platform==='win32'?'Edge':'Playwright Chromium';

export function launchRiderBrowser(){
  const selection=process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:process.platform==='win32'?{channel:'msedge'}:{};
  return chromium.launch({...selection,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
}
