const getTrendAndSave = require('../app-actions/get-trend-and-save');
const login = require('../rh-actions/login');

const mapLimit = require('promise-map-limit');

const DEFAULT_OPTS = {
  BUFFERS: [ 10, 20, 30 ],
  MIN_SWINGS: [ 4, 5, 6 ],
  MIN_DIFF: 120
};

let Robinhood;

const getHistorical = async ticker => {
  const historicalDailyUrl = `https://api.robinhood.com/quotes/historicals/${ticker}/?interval=10minute&span=week`;
  let { historicals } = await Robinhood.url(historicalDailyUrl);
  return (historicals.length) ? historicals : [];
};

(async () => {

  Robinhood = await login();

  let trend = require('/Users/johnmurphy/Development/my-stuff/robinhood-playground/stock-data/2018-2-3 15:09:00 (+515).json');
  // let trend = await getTrendAndSave(Robinhood);


  let cheapBuys = trend
    .filter(stock => {
      return Number(stock.quote_data.last_trade_price) < 6 &&
      Number(stock.quote_data.last_trade_price) > .2;
    });

  let curIndex = 0;
  const withHistoricals = await mapLimit(cheapBuys, 2, async buy => {

  if (curIndex % Math.floor(cheapBuys.length / 10) === 0) {
    console.log('historical', curIndex, 'of', cheapBuys.length);
  }
  curIndex++;

  let historicals = await getHistorical(buy.ticker);
  historicals = historicals.map(hist => {
    ['open_price', 'close_price', 'high_price', 'low_price'].forEach(key => {
    hist[key] = Number(hist[key]);
    });
    return hist;
  });

  return {
    // ticker: buy.ticker,
    ...buy,
    historicals,
  };

  });

  const generateSwing = (buys, bufferSize, minDiff, minSwings) => {
    console.log(minSwings, 'minSwings');
    return buys.map(buy => {
      const { historicals } = buy;
      const closePrices = historicals.map(hist => hist.close_price);

      const [max, min] = [
        Math.max(...closePrices),
        Math.min(...closePrices)
      ];
      const diff = max - min;
      const inLowSegment = price => price < min + (diff * bufferSize / 100);
      const inHighSegment = price => price > max - (diff * bufferSize / 100);

      let lastSegment; // 2 = high, 1 = low
      let numSwings = 0;
      historicals.forEach(hist => {
        let newSegment;
        if (inLowSegment(hist.close_price)) {
          newSegment = 1;
        } else if (inHighSegment(hist.close_price)) {
          newSegment = 2;
        }
        if (newSegment && lastSegment !== newSegment) {
          numSwings++;
          console.log(buy.ticker, 'now', newSegment);
          console.log('closing at ', hist.close_price, hist.begins_at);
        }
        lastSegment = newSegment || lastSegment;
      });

      return {
        ticker: buy.ticker,
        max,
        min,
        numSwings,
        isInLowSegment: inLowSegment(Number(buy.last_trade_price)),
        diffRatio: Math.round(max / min * 100),
        daysInLow: (() => {

          let numDays = 0;
          historicals.reverse().some(hist => {
            numDays++;
            return !inLowSegment(hist.close_price);
          });
          return numDays;

        })()
      };
    })
      .filter(buy => buy.isInLowSegment && buy.numSwings >= minSwings)
      .filter(buy => buy.diffRatio > minDiff)
      .sort((a, b) => b.numSwings - a.numSwings);
  };

  const stockResults = {};
  const handleSwings = (swings, { bufferSize }) => {
    swings.forEach(({ ticker, diffRatio, numSwings, daysInLow }) => {
      const title = `buffer: ${bufferSize}`;
      const points = diffRatio * numSwings * (35 - bufferSize);
      stockResults[ticker] = (stockResults[ticker] || []).concat({
        diffRatio,
        numSwings,
        daysInLow,
        swingTitle: title,
        points
      });
    });
  };

  const {
    BUFFERS: buffers,
    MIN_DIFF: minDiff,
    MIN_SWINGS: minSwings
  } = DEFAULT_OPTS;
  buffers.forEach(bufferSize => {
    minSwings.forEach(minSwing => {
      const swings = generateSwing(withHistoricals, bufferSize, minDiff, minSwing);
      handleSwings(swings, {
        bufferSize
      });
    });
  });
  // aggregate ticker swings
  Object.keys(stockResults).forEach(ticker => {
    const swings = stockResults[ticker];
    const totalPoints = swings
      .map(swing => swing.points)
      .reduce((acc, val) => acc + val, 0);
    stockResults[ticker] = {
      totalPoints,
      swings
    };
  });
  // order by totalPoints
  Object.keys(stockResults)
    .sort((a, b) => stockResults[b].totalPoints - stockResults[a].totalPoints)
    .forEach(ticker => {
      console.log(ticker);
      console.log(JSON.stringify(stockResults[ticker], null, 2));
    });


})();
