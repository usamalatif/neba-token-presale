Presale flow and vesting spec for $NEBA

Short answer
_processPurchase() should not transfer tokens before TGE.
It should only create a vesting schedule for the buyer.
Tokens stay in Treasury and are prefunded to the Vesting contract shortly before TGE.    

End to end flow
User passes KYC and is allowlisted. Restricted jurisdictions are blocked.  
Frontend reads sale status, min and max limits, and current rate directly on chain.
Crypto purchase calls purchase(). Fiat purchase goes through MoonPay and backend calls allocateFiat().  
Sale contract computes tokenAmount from USD at the sale price and rate.
Sale contract calls Vesting.createSchedule with round parameters. No token transfer to the buyer.
Multisig Treasury funds the Vesting contract with the aggregate sold amount before TGE.  
At TGE users claim per their schedule in the Claim Portal.  

Where tokens sit at each moment
Before any sale all supply is minted once to the Treasury multisig.  
During presale all investor allocations remain in Treasury. Vesting schedules exist as on chain liabilities only.
Pre TGE Treasury funds the Vesting contract address.
Post TGE locked tokens remain in Vesting. Unlocked parts are claimed to the user wallet.
Liquidity allocation is separate and 100 percent available at TGE for exchange listings.  

Vesting business logic by round
Strategic or Private. Price 0.012 USD. TGE unlock 12.5 percent. Cliff 3 months after TGE. Linear vesting 6 months.  
Community Presale. TGE unlock 10 percent. Cliff 1 month. Linear vesting 12 months.  
Public Sale. TGE unlock 20 percent. No cliff. Linear vesting 6 months.  
Claim happens in the Vesting Dashboard on nebatoken.com after TGE.  

Contracts and roles
NEBA Token. ERC20 using OpenZeppelin. UUPS upgradeable. All supply minted once to Treasury multisig Safe. No public mint or burn.  
Sales Smart Contract. Conducts presales via nebatoken.com. Holds no investor funds in tokens.  
Vesting Contract. Holds investor tokens post funding. Creates schedules with TGE unlock, cliff, linear release.
KYC Gate. Off chain provider. On chain allowlist via Merkle root or EIP 712 signature. Restricted countries are blocked.  

Key parameters to implement now
Min purchase per transaction 25 USD.
Max purchase per transaction 499 USD.
Reject out of range attempts with errors MIN_PURCHASE_USD and MAX_PURCHASE_USD.
Enforce per address cap if requested by backend.
Accept crypto methods per chain. Accept fiat via MoonPay with backend settlement.  

Suggested function interfaces
function purchase(address paymentToken, uint256 paymentAmount, address beneficiary) external whenActive nonReentrant onlyAllowlisted
function allocateFiat(address beneficiary, uint256 usdAmount, bytes32 orderId) external onlyBackend whenActive
function setRate(address paymentToken, uint256 usdPerToken) external onlyOwner
function setMinMax(uint256 minUsd, uint256 maxUsd) external onlyOwner
Errors MIN_PURCHASE_USD and MAX_PURCHASE_USD

Vesting API
createSchedule(address beneficiary, uint256 total, uint16 tgeBps, uint64 startTs, uint64 cliffSec, uint64 durationSec, uint64 sliceSec, bool revocable) external onlySales
claim() external returns (uint256 released)

Round presets for createSchedule
Strategic or Private. tgeBps 1250. cliffSec 90 days. durationSec 180 days. sliceSec 1 day.  
Community Presale. tgeBps 1000. cliffSec 30 days. durationSec 360 days. sliceSec 1 day.  
Public Sale. tgeBps 2000. cliffSec 0. durationSec 180 days. sliceSec 1 day.  

ProcessPurchase pseudocode
requireAllowlisted(msg.sender)
usd = convertToUsd(paymentToken, paymentAmount)
require(usd between min and max)
amount = usd * 1e18 / priceUsd
createSchedule(beneficiary, amount, round.tgeBps, tgeTimestamp, round.cliff, round.duration, 1 day, false)
emit Purchased(beneficiary, usd, amount, roundId)

Security and operations
Sale has states NotStarted Active Paused Ended. Only Active accepts purchases.
Cooldown per wallet to reduce bots.
Pause switch and parameter changes gated by multisig with timelock.
All investor schedules are non revocable.