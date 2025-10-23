// --- Configuration ---
// The 2% fee is applied to the gross profit (the money earned above the initial cost).
const TAKER_FEE_RATE = 0.04; // 2% fee

// We will use a very general selector but rely on filtering to prevent unnecessary work.
const PRICE_SELECTOR = 'span, div, button'; // Target all potential price holders
const ODDS_CLASS = 'american-odds-2pct-display';

/**
 * Converts a price (in dollars, e.g., 0.73) into American Odds,
 * adjusted by a fee on the gross profit.
 *
 * @param {number} price Price of the contract (P in dollars, 0.01 to 0.99).
 * @returns {string} The formatted American odds string (e.g., "+270" or "-270").
 */
function convertPriceToAmericanOddsWithFee(price) {
    if (price <= 0 || price >= 1) {
        return "N/A";
    }

    // 1. Calculate Gross Profit (The max profit you can make on a $1 contract)
    const grossProfit = 1.00 - price;

    // 2. Calculate the Fee (2% of the gross profit)
    const feeAmount = grossProfit * TAKER_FEE_RATE;

    // 3. Calculate Net Profit (The profit after the fee is taken)
    const netProfit = grossProfit - feeAmount;
    
    // 4. Determine American Odds based on Price (Wager) and Net Profit
    let odds;
    
    // If P > 0.50 (favorite), the odds are negative.
    if (price > 0.50) {
        // Negative Odds Formula: -100 / (Wager / Net Profit)
        odds = (-100 * price) / netProfit;
    } 
    // If P <= 0.50 (underdog or 50/50), the odds are positive.
    else {
        // Positive Odds Formula: 100 * (Net Profit / Wager)
        odds = (100 * netProfit) / price;
    }

    // Round to the nearest whole number for standard odds display
    const finalOdds = Math.round(odds);

    // Format the final result
    if (finalOdds <= 0) {
        return finalOdds.toString();
    } else {
        return "+" + finalOdds.toString();
    }
}

/**
 * Main function to find and update the prices on the page.
 */
function updateOdds() {
    // We target a wide range of elements and filter them by their text content.
    const priceElements = document.querySelectorAll(PRICE_SELECTOR);

    priceElements.forEach(element => {
        
        // --- DUPLICATION GUARD (1): Skip if the element already contains our odds span
        // We check the entire subtree of the element for our class before processing.
        if (element.querySelector('.' + ODDS_CLASS)) {
            return;
        }

        const textContent = element.textContent.trim();
        let priceDecimal = null;
        let americanOdds = null;

        // --- 1. Match Cents (Order Book Prices, e.g., "75¢") ---
        // CRITICAL: We only process the element if it has NO child elements (it's the lowest node)
        // AND its text matches the price pattern. This targets the innermost price span.
        const centMatch = textContent.match(/^(\d{1,2})¢$/); 
        if (centMatch && element.children.length === 0) { 
            const priceCents = parseFloat(centMatch[1]);
            if (priceCents >= 1 && priceCents <= 99) {
                priceDecimal = priceCents / 100.0;
            }
        } 
        
        // --- 2. Match Percentages (Main Chance Displays & Buttons) ---
        if (!priceDecimal) {
            const percentMatch = textContent.match(/(\d{1,3}(?:\.\d+)?)%/);
            if (percentMatch) {
                const pricePercentage = parseFloat(percentMatch[1]);
                if (pricePercentage >= 1 && pricePercentage <= 99) {
                     priceDecimal = pricePercentage / 100.0;
                }
            } 
        }
        
        // --- INJECTION LOGIC ---
        if (priceDecimal) {
            americanOdds = convertPriceToAmericanOddsWithFee(priceDecimal);
            
            // ----------------------------------------------------------------
            // Case A: Order Book Price (Needs Absolute Positioning for alignment)
            // Target the DIV with width: 44px style (two parents up from the innermost span)
            let parentDiv = element.parentElement; // First parent (span)
            if (parentDiv) parentDiv = parentDiv.parentElement; // Second parent (div with width: 44px)

            if (parentDiv && parentDiv.style.width === '44px') {
                
                // Check if this parent container has already had the absolute odds injected (prevents infinite loop/duplication)
                if (parentDiv.querySelector(`.${ODDS_CLASS}`)) {
                    return;
                }

                // Set the price container to relative positioning to anchor the absolutely positioned odds
                parentDiv.style.position = 'relative'; 

                // Position the odds span absolutely inside the parent div (width: 44px).
                const oddsHTML = `<span class="${ODDS_CLASS}" style="position: absolute; right: 46px; top: 0; font-size: 11px; font-weight: 500; white-space: nowrap; color: rgba(0, 0, 0, 0.7);">(${americanOdds})</span>`;
                parentDiv.insertAdjacentHTML('beforeend', oddsHTML);
                
                return; // STOP: Injection is complete for this order book item.
            }
            // ----------------------------------------------------------------
            
            // ----------------------------------------------------------------
            // Case B: Inline Price (Percentages and Buttons)
            
            // Standard injection check: If the element has no children (is the lowest text node), inject.
            if (element.children.length === 0) {
                 const oddsHTML = `<span class="${ODDS_CLASS}" style="font-weight: 500; margin-left: 2px; white-space: nowrap; color: rgba(0, 0, 0, 0.7);">(${americanOdds})</span>`;
                element.insertAdjacentHTML('beforeend', oddsHTML);
            }
            // ----------------------------------------------------------------
        }
    });
}

// Initial run
updateOdds();

// Setup a MutationObserver to watch for changes in the DOM
const observer = new MutationObserver(mutations => {
    // Use a short delay (50ms) to let the DOM settle after changes (performance optimization)
    const shouldUpdate = mutations.some(mutation => mutation.addedNodes.length > 0);
    if (shouldUpdate) {
        clearTimeout(window.kalshiOddsTimeout);
        window.kalshiOddsTimeout = setTimeout(updateOdds, 50);
    }
});

// Start observing the entire document body for changes
observer.observe(document.body, { childList: true, subtree: true });
