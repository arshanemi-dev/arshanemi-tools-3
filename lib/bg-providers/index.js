import * as rembg from './rembg'
import * as poof from './poof'
import * as photoroom from './photoroom'

export const PROVIDERS = { medium: rembg, advanced: poof, pro: photoroom }

export function getStatus() {
  return {
    medium: rembg.isConfigured(),
    advanced: poof.isConfigured(),
    pro: photoroom.isConfigured(),
  }
}
