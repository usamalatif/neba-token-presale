please prepare a no-KYC fallback mode.



Set a strict per-wallet cap of 499 USD per rolling 24 hours.
Enable via FEATURE_NO_KYC_FALLBACK=1 and disable when KYC/KYT goes live.
Accept USDC and USDT at 1.00 USD.
For ETH, compute USD via Chainlink ETH/USD on Base or a TWAP with max 5-minute staleness.



Implement on-chain accounting for the 24-hour window per wallet.
Maintain mapping for spentUSD and windowStart per wallet.
Revert when a purchase would exceed 499 USD within the window.
Emit events FallbackModeEnabled, FallbackModeDisabled, DailyCapUpdated, and PurchaseBlockedByCap.
Gate toggling only by operator or through Safe.



Keep current distribution logic transferFrom(treasury, buyer, amountOut).
Do not store any personal data on-chain.



Backend and frontend must reflect fallback mode.
Show a banner: “Temporary no-KYC mode: 499 USD/day per wallet.”
Hide KYC screens while the flag is enabled.
Expose remainingUSD for the active 24-hour window.
Error copy: “Daily limit reached. Try again after the 24-hour window resets.”



Test cases to implement.
Allow 499.00 USD exactly across one or multiple purchases.
Block when the next purchase would exceed 499.00 USD.
Verify mixed-asset flows across USDC, USDT, and ETH within the same window.
Verify window reset crossing the 24-hour boundary.
Block when ETH price feed is stale or unavailable.
Verify pause/unpause paths in fallback mode.
Verify operator/Safe toggling and all event emissions.



Reversion plan when Sumsub API is ready.
Disable FEATURE_NO_KYC_FALLBACK.
Re-enable whitelist gating with KYC PASS and KYT PASS.
Keep or remove the daily cap per policy.



Deliverables.
Updated and verified Sales contract with new ABI and events.
Sepolia deployment with addresses and tx hashes.
Short test report with logs and screenshots.
Config notes for enabling/disabling the flag.