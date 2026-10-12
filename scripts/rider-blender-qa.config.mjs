import base from '../vite.config.ts';
export default {...base,test:{...base.test,include:['scripts/rider-blender-quality.test.ts']}};
