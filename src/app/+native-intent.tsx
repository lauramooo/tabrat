// Turns a tap-to-join Universal Link (https://lauramooo.github.io/tabrat/join?code=123456) into the
// app's join screen. Everything else (including tabrat://join/123456) passes through unchanged.
// `path` may be a full URL or just a path, so match loosely — and never throw in here.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const m = /\/tabrat\/join(?:\.html)?\/?\?(?:.*&)?code=(\d{6})/.exec(path);
    return m ? `/join/${m[1]}` : path;
  } catch {
    return path;
  }
}
