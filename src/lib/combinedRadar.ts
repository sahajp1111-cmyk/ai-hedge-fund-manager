export type CombinedRadarInput={
 quality:number; valuation:number; technical:number; physics:number; institutional:number; catalyst:number;
 businessAcceleration:number; earningsAcceleration:number; marginAcceleration:number; cashFlowAcceleration:number;
 orderBacklogAcceleration:number; priceAcceleration:number; hypePenalty:number; financialSafety:number;
};
const clamp=(x:number)=>Math.max(0,Math.min(100,x));
export function combinedRadar(x:CombinedRadarInput){
 const qualityRadar=.25*x.quality+.20*x.valuation+.20*x.technical+.15*x.physics+.10*x.institutional+.10*x.catalyst;
 const fundamentalVelocity=.22*x.businessAcceleration+.20*x.earningsAcceleration+.15*x.marginAcceleration+
   .13*x.cashFlowAcceleration+.20*x.orderBacklogAcceleration+.10*x.financialSafety;
 const priceLag=clamp(100-x.priceAcceleration);
 const discoveryGap=clamp(.65*fundamentalVelocity+.25*priceLag-.35*x.hypePenalty);
 const combined=clamp(.55*qualityRadar+.45*discoveryGap);
 const state=x.hypePenalty>=70&&qualityRadar>=70?"QUALITY_DISCOVERED":
   discoveryGap>=75&&qualityRadar>=70?"PRE_DISCOVERY":
   combined>=75?"DEEP_RESEARCH":combined>=65?"WATCH":"REJECT";
 return {qualityRadar:+qualityRadar.toFixed(2),fundamentalVelocity:+fundamentalVelocity.toFixed(2),
  discoveryGap:+discoveryGap.toFixed(2),combined:+combined.toFixed(2),state};
}
