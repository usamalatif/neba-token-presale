NEBA Token Sales Smart Contract Audit



## 🎯 Key Findings



Overall Assessment: MEDIUM-HIGH RISK ⚠️



### 🔴 Critical Issues (2):



1. Missing Adequate Reentrancy Protection - FundsVault may be vulnerable to reentrancy attacks during ETH withdrawals
2. Chainlink Oracle Without Fallback - If the oracle fails, the entire system stops. No staleness checks or backup mechanism



### 🟠 High Issues (4):



1. 2-Day Timelock Too Short - Community doesn't have enough time to react
2. Missing Cap Validation - Possible to allocate more tokens than available
3. Front-running Vulnerability - At round starts
4. Integer Overflow Risks - In large number calculations



### 🟡 Medium Issues (6):



- Rate limiter can be bypassed with multiple addresses
- Missing emergency withdrawal mechanism
- Excessive multisig dependency
- Gas optimization issues
- Lack of granular pause functionality
- KYC centralization



## ✅ Positives:



- Good modular architecture with 7 separate contracts
- Multi-currency support (USDC, USDT, ETH)
- Anti-bot protection with rate limiting
- KYC/Whitelist system
- Non-upgradeable design (immutability)



## ⚠️ Critical Recommendation:



DO NOT recommend mainnet deployment before:
1. Professional external audit ($30k-$80k)
2. Addressing all CRITICAL and HIGH findings
3. Minimum 2 weeks testnet testing
4. Public bug bounty program