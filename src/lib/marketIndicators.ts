export type OHLCV={open:number;high:number;low:number;close:number;volume:number};
const mean=(x:number[])=>x.reduce((a,b)=>a+b,0)/Math.max(1,x.length);
const sd=(x:number[])=>{const m=mean(x);return Math.sqrt(mean(x.map(v=>(v-m)**2)))};
const clamp=(x:number)=>Math.max(0,Math.min(100,x));
const ema=(x:number[],n:number)=>{const k=2/(n+1);return x.slice(1).reduce((a,v)=>v*k+a*(1-k),x[0])};
export function indicators(rows:OHLCV[]){
 if(rows.length<200) throw new Error("Need >=200 daily bars");
 const c=rows.map(x=>x.close),v=rows.map(x=>x.volume);
 const sma=(n:number)=>mean(c.slice(-n));
 const changes=c.slice(1).map((x,i)=>x-c[i]), last14=changes.slice(-14);
 const gains=mean(last14.map(x=>Math.max(x,0))),loss=mean(last14.map(x=>Math.max(-x,0)));
 const rsi=loss===0?100:100-100/(1+gains/loss);
 const macd=ema(c.slice(-80),12)-ema(c.slice(-80),26);
 const signal=ema(c.slice(-80).map((_,i,a)=>i<26?0:ema(c.slice(Math.max(0,i-26),i+1),12)-ema(c.slice(Math.max(0,i-26),i+1),26)),9);
 const tr=rows.slice(1).map((r,i)=>Math.max(r.high-r.low,Math.abs(r.high-rows[i].close),Math.abs(r.low-rows[i].close)));
 const atr=mean(tr.slice(-14));
 const m20=sma(20), s20=sd(c.slice(-20)), z20=s20?(c.at(-1)!-m20)/s20:0;
 const relVolume=v.at(-1)!/Math.max(1,mean(v.slice(-21,-1)));
 const trend=(c.at(-1)!>sma(50)?15:0)+(c.at(-1)!>sma(200)?20:0)+(sma(50)>sma(200)?15:0);
 const momentum=clamp(50+(rsi-50)*.7+(macd-signal)/(atr||1)*20);
 const technicalScore=clamp(trend+momentum*.5+clamp(relVolume*35)*.25);
 return {rsi:+rsi.toFixed(2),macd:+macd.toFixed(4),macdSignal:+signal.toFixed(4),atr:+atr.toFixed(4),
  sma20:+m20.toFixed(4),sma50:+sma(50).toFixed(4),sma200:+sma(200).toFixed(4),z20:+z20.toFixed(3),
  relativeVolume:+relVolume.toFixed(2),technicalScore:+technicalScore.toFixed(2)};
}
export type FundamentalInput={roic:number;fcfMargin:number;netDebtToEbitda:number;revenueCagr:number;epsCagr:number;fcfYield:number};
export function fundamentalScore(x:FundamentalInput){
 const quality=clamp(50+x.roic*1.5+x.fcfMargin*.7-x.netDebtToEbitda*8);
 const growth=clamp(50+x.revenueCagr+x.epsCagr);
 const value=clamp(50+x.fcfYield*3);
 return {quality:+quality.toFixed(2),growth:+growth.toFixed(2),value:+value.toFixed(2),
  score:+(.5*quality+.25*growth+.25*value).toFixed(2)};
}
