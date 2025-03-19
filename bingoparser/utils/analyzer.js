const axios = require('axios');
require('dotenv').config();

const API_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function retryOperation(operation, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
}

async function fetchCoinData() {
    try {
        // First get all perpetual contracts info
        const contractsResponse = await retryOperation(() => 
            axios.get('https://open-api.bingx.com/openApi/swap/v2/quote/contracts', {
                timeout: API_TIMEOUT,
                headers: {
                    'X-BX-APIKEY': process.env.BINGX_API_KEY,
                    'Content-Type': 'application/json'
                }
            })
        );

        if (!contractsResponse.data || !contractsResponse.data.data) {
            throw new Error('Invalid contracts response format');
        }

        // Get the top 100 futures by volume
        const top100Symbols = contractsResponse.data.data
            .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
            .slice(0, 100)
            .map(contract => contract.symbol);

        if (top100Symbols.length === 0) {
            throw new Error('No symbols found in contracts response');
        }

        // Get prices for top 100
        const priceResponse = await retryOperation(() =>
            axios.get('https://open-api.bingx.com/openApi/swap/v2/quote/price', {
                timeout: API_TIMEOUT,
                headers: {
                    'X-BX-APIKEY': process.env.BINGX_API_KEY,
                    'Content-Type': 'application/json'
                }
            })
        );

        if (!priceResponse.data || !priceResponse.data.data) {
            throw new Error('Invalid price response format');
        }

        // Filter prices for top 100 symbols only
        const prices = priceResponse.data.data
            .filter(price => top100Symbols.includes(price.symbol));

        if (prices.length === 0) {
            throw new Error('No price data available for selected symbols');
        }

        return prices;
    } catch (error) {
        console.error('Error fetching coin data:', {
            message: error.message,
            code: error.code,
            response: error.response?.data
        });

        // Instead of returning fake data, throw the error to be handled by the caller
        throw new Error('Failed to fetch market data: ' + error.message);
    }
}

function analyzeCoinData(coins) {
    if (!Array.isArray(coins) || coins.length === 0) {
        throw new Error('Invalid input: coins must be a non-empty array');
    }

    return coins.map(coin => {
        if (!coin.price || !coin.symbol) {
            throw new Error('Invalid coin data format');
        }

        const price = parseFloat(coin.price);
        if (isNaN(price)) {
            throw new Error(`Invalid price for symbol ${coin.symbol}`);
        }

        const trend = determineTrend(price);
        const wave = calculateElliottWave(price);
        
        return {
            symbol: coin.symbol.replace('USDT', '').toLowerCase(),
            trend: trend,
            currentPrice: formatPrice(price),
            elliottWave: wave,
            entryPoint: formatPrice(calculateEntryPoint(price, trend)),
            takeProfit: formatPrice(calculateTakeProfit(price, trend)),
            stopLoss: formatPrice(calculateStopLoss(price, trend)),
            probability: calculateProbability(trend, wave)
        };
    });
}

function formatPrice(price) {
    if (typeof price !== 'number' || isNaN(price)) {
        throw new Error('Invalid price format');
    }
    return price.toFixed(price >= 100 ? 2 : 4);
}

function determineTrend(price) {
    // TODO: Implement actual trend analysis using historical data
    const random = Math.random();
    if (random > 0.6) return 'Восходящий';
    if (random > 0.3) return 'Нисходящий';
    return 'Боковой';
}

function calculateElliottWave(price) {
    // TODO: Implement actual Elliott Wave analysis
    const waves = [
        'Волна 1', 'Волна 2', 'Волна 3', 'Волна 4', 'Волна 5',
        'Волна A', 'Волна B', 'Волна C'
    ];
    return waves[Math.floor(Math.random() * waves.length)];
}

function calculateEntryPoint(price, trend) {
    if (typeof price !== 'number' || isNaN(price)) {
        throw new Error('Invalid price for entry point calculation');
    }

    if (trend === 'Восходящий') {
        return price * 0.98; // 2% ниже текущей цены
    } else if (trend === 'Нисходящий') {
        return price * 0.95; // 5% ниже текущей цены
    }
    return price; // Текущая цена для бокового тренда
}

function calculateTakeProfit(price, trend) {
    if (typeof price !== 'number' || isNaN(price)) {
        throw new Error('Invalid price for take profit calculation');
    }

    if (trend === 'Восходящий') {
        return price * 1.05; // 5% прибыли
    } else if (trend === 'Нисходящий') {
        return price * 1.03; // 3% прибыли
    }
    return price * 1.02; // 2% прибыли для бокового тренда
}

function calculateStopLoss(price, trend) {
    if (typeof price !== 'number' || isNaN(price)) {
        throw new Error('Invalid price for stop loss calculation');
    }

    if (trend === 'Восходящий') {
        return price * 0.95; // 5% убытка
    } else if (trend === 'Нисходящий') {
        return price * 0.92; // 8% убытка
    }
    return price * 0.97; // 3% убытка для бокового тренда
}

function calculateProbability(trend, wave) {
    if (!trend || !wave) {
        throw new Error('Missing trend or wave for probability calculation');
    }

    let probability = 0.5; // Базовая вероятность

    // Корректировка на основе тренда
    if (trend === 'Восходящий') probability += 0.1;
    if (trend === 'Нисходящий') probability += 0.05;

    // Корректировка на основе волны Эллиотта
    if (wave === 'Волна 3' || wave === 'Волна 5') probability += 0.15;
    if (wave === 'Волна 2' || wave === 'Волна 4') probability -= 0.1;

    // Убеждаемся, что вероятность между 0 и 1
    return Math.min(Math.max(probability, 0), 1).toFixed(2);
}

module.exports = {
    fetchCoinData,
    analyzeCoinData,
};