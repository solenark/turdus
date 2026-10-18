import { DEFAULT_SETTINGS, type AnalysisSettings, type VoiceProfile } from './audio/analysis';
import { getInstrument, type InstrumentId } from './audio/instruments';

const SETTINGS_KEY = 'turdus.settings.v1';
const PROFILE_KEY = 'turdus.profile.v1';
const INSTRUMENT_KEY = 'turdus.instrument.v1';

// localStorage can fail (private tab, blocked storage): the app falls back to the defaults.
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* no storage: the value lasts for this session only */
  }
}

/** User-saved defaults, filled in with factory values (covers settings added in later versions). */
export const loadDefaults = (): AnalysisSettings => ({ ...DEFAULT_SETTINGS, ...read<Partial<AnalysisSettings>>(SETTINGS_KEY) });
export const saveDefaults = (s: AnalysisSettings) => write(SETTINGS_KEY, s);

export interface StoredProfile extends VoiceProfile {
  calibratedAt: string;
}
export const loadProfile = () => read<StoredProfile>(PROFILE_KEY);
export const saveProfile = (p: StoredProfile | null) => write(PROFILE_KEY, p);

export const loadInstrument = (): InstrumentId => getInstrument(read<string>(INSTRUMENT_KEY) ?? '').id;
export const saveInstrument = (id: InstrumentId) => write(INSTRUMENT_KEY, id);
