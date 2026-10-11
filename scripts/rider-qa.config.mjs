// Node-only geometry audit tooling, separate from the browser-targeted src typecheck.
import base from '../vite.config.ts';
export default {...base,test:{...base.test,include:['scripts/rider-garment-quality.test.ts']}};
