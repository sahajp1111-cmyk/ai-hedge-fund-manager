import { indicators, fundamentalScore, type OHLCV } from "./marketIndicators";
const bars:OHLCV[]=Array.from({length:240},(_,i)=>{const close=50*Math.exp(.0015*i+Math.sin(i/9)*.018);return {open:close*.995,high:close*1.012,low:close*.988,close,volume:1_000_000*(1+(i%11===0?.5:.05))}});
console.log("TECHNICAL",indicators(bars));
console.log("FUNDAMENTAL",fundamentalScore({roic:16,fcfMargin:11,netDebtToEbitda:1.2,revenueCagr:9,epsCagr:13,fcfYield:6}));
