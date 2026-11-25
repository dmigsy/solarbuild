# Smyths Ireland PS5 stock checker

Checks Smyths Toys Ireland for PS5 consoles every 30 min and sends a phone push (ntfy) when any is in stock. Separate from the solar tool; no dependencies.

## Setup
1. Install the **ntfy** app (iOS/Android) and subscribe to a hard-to-guess topic, e.g. `ps5-smyths-k3v9x2q7`. Anyone who knows the topic name can read it.
2. In GitHub: repo **Settings → Secrets and variables → Actions → New repository secret**. Name `NTFY_TOPIC`, value = your topic.
3. Merge this branch to the default branch (scheduled workflows only run from the default branch).
4. **Actions** tab → *Smyths PS5 stock check* → **Run workflow** to test.

If a run fails, Smyths blocked GitHub or its page layout changed. GitHub emails you about failed runs.

## Local use
```
python3 stock-checker/check.py --dry-run          # no push
NTFY_TOPIC=your-topic python3 stock-checker/check.py --test-notify
```
Env overrides: `SMYTHS_PAGES` (comma-separated listing/search URLs), `SMYTHS_PRODUCTS` (specific product URLs).

Not tested against the live site: the build environment cannot reach smythstoys.com.
