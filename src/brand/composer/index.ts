/**
 * Public surface of the brand pixel-scene composer (#83). Import from here:
 *   import { composeScene } from "#/brand/composer"
 */

export {
  type Expression,
  type Pose,
  spritePathFor,
} from "#/brand/composer/astro";
export {
  CHANNELS,
  type Channel,
  type ChannelConfig,
  exportSizeFor,
} from "#/brand/composer/channels";
export { composeScene } from "#/brand/composer/composeScene";
export {
  DEFAULT_RENDER_SET,
  type NamedRender,
  writeRender,
} from "#/brand/composer/render-set";
export type {
  ComposeSceneInput,
  ComposeSceneResult,
  SceneSidecar,
} from "#/brand/composer/types";
