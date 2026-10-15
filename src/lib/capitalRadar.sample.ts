import { capitalRadar, SeriesPoint } from "./capitalRadar";

function synthetic(start:number, drift:number, noise:number, volBase:number):SeriesPoint[]{
  return Array.from({length:60},(_,i)=>{
    const wave=Math.sin(i/4)*noise;
    return {close:start*Math.exp(drift*i+wave),volume:volBase*(1+(i%7===0?0.45:0.05))};
  });
}

// Deterministic SAMPLE data: validates calculations only; not live market data.
const samples=[
 {ticker:"SAMPLE_RECOVERY",prices:synthetic(18,.003,.012,1_000_000),fundamental:86,valuation:80,institutional:78,catalyst:82},
 {ticker:"SAMPLE_VALUE",prices:synthetic(30,.001,.006,700_000),fundamental:90,valuation:88,institutional:62,catalyst:55},
 {ticker:"SAMPLE_WEAK",prices:synthetic(12,-.003,.015,500_000),fundamental:48,valuation:60,institutional:35,catalyst:40}
];
for(const s of samples) console.log(JSON.stringify(capitalRadar(s),null,2));
