export type SeriesPoint = { close: number; volume: number };

export type RadarInput = {
  ticker: string;
  prices: SeriesPoint[];
  fundamental: number;     // 0..100, computed upstream from ROIC/FCF/leverage/quality
  valuation: number;       // 0..100
  institutional: number;   // 0..100
  catalyst: number;        // 0..100
};

export type PhysicsSignal = {
  velocity: number;
  acceleration: number;
  relativeVolume: number;
  energy: number;
  entropy: number;
  zScore20: number;
  physicsScore: number;
};

const clamp=(x:number,lo=0,hi=100)=>Math.min(hi,Math.max(lo,x));
const mean=(x:number[])=>x.reduce((a,b)=>a+b,0)/Math.max(1,x.length);
const sd=(x:number[])=>{const m=mean(x);return Math.sqrt(mean(x.map(v=>(v-m)**2)))};

export function physicsSignal(points: SeriesPoint[]): PhysicsSignal {
  if(points.length<22) throw new Error("Need at least 22 observations");
  const p=points.map(x=>x.close), vol=points.map(x=>x.volume);
  const logs=p.slice(1).map((x,i)=>Math.log(x/p[i]));
  const velocity=mean(logs.slice(-5));
  const prevVelocity=mean(logs.slice(-10,-5));
  const acceleration=velocity-prevVelocity;
  const relativeVolume=vol.at(-1)!/Math.max(1,mean(vol.slice(-21,-1)));
  const energy=0.5*relativeVolume*velocity*velocity;
  const w=p.slice(-20), s=sd(w);
  const zScore20=s ? (p.at(-1)!-mean(w))/s : 0;

  // Shannon entropy of return direction/magnitude buckets. Lower = more ordered.
  const recent=logs.slice(-20);
  const sigma=sd(recent)||1e-9;
  const buckets=[0,0,0,0,0];
  for(const r of recent){
    const k=r<-sigma?0:r<0?1:r===0?2:r<=sigma?3:4; buckets[k]++;
  }
  const probs=buckets.filter(Boolean).map(n=>n/recent.length);
  const entropy=-probs.reduce((a,q)=>a+q*Math.log(q),0)/Math.log(5);

  // Physics-inspired features are statistical analogies, not literal physical laws.
  const trend=clamp(50+velocity*1800);
  const accel=clamp(50+acceleration*4000);
  const participation=clamp(relativeVolume*50);
  const order=clamp((1-entropy)*100);
  const zHealthy=clamp(100-Math.abs(zScore20-0.75)*30);
  const physicsScore=.30*trend+.20*accel+.20*participation+.15*order+.15*zHealthy;
  return {velocity,acceleration,relativeVolume,energy,entropy,zScore20,physicsScore};
}

export function capitalRadar(input: RadarInput){
  const physics=physicsSignal(input.prices);
  const technical=clamp(.55*physics.physicsScore+.45*clamp(50+physics.zScore20*15));
  const score=.25*input.fundamental+.20*input.valuation+.20*technical+
    .15*physics.physicsScore+.10*input.institutional+.10*input.catalyst;
  const signal=score>=85?"DEEP_RESEARCH":score>=70?"WATCH":"REJECT";
  return {ticker:input.ticker,score:+score.toFixed(2),signal,technical:+technical.toFixed(2),physics};
}
