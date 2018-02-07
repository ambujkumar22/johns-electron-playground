const { CronJob } = require('cron');

let allCrons = [];

const regCronIncAfterSixThirty = (Robinhood, { name, run, fn }) => {
  const d = new Date();
  d.setHours(6, 30);
  run.forEach((min, index) => {
    const newDateObj = new Date(d.getTime() + min * 60000);
    newDateObj.setSeconds(0);
    const cronStr = `${newDateObj.getMinutes()} ${newDateObj.getHours()} * * 1-5`;

    allCrons.push({
      date: newDateObj,
      cronStr,
      name
    });
    // console.log('push all', allCrons);
    new CronJob(cronStr, () => {
      console.log('starting cron: ', name);
      fn(Robinhood, min, index);
    }, null, true);
  });
};

regCronIncAfterSixThirty.display = function() {
  allCrons = allCrons.sort((b, a) => b.date - a.date);
  allCrons.forEach(({cronStr, date, name}) => {
    console.log(date.toLocaleTimeString(), cronStr, name, ' - ', );
  });
};

module.exports = regCronIncAfterSixThirty;
