import {Image,View} from 'react-native';
import {Assets} from '../lib/assets';
export function BrandLogo({compact=false,dark=false,small=false}:{compact?:boolean;dark?:boolean;small?:boolean}){
 return <View style={{paddingVertical:small?0:compact?8:12,paddingHorizontal:compact?8:12,alignSelf:'flex-start',maxWidth:'100%'}}><Image source={compact?Assets.brand.logoMark:dark?Assets.brand.logoHorizontalDark:Assets.brand.logoHorizontal} accessibilityLabel="SmartBasket" resizeMode="contain" style={compact?{width:40,height:40}:{width:small?180:220,height:small?42:55,maxWidth:'100%'}} /></View>;
}
export type IllustrationKind='emptyBasket'|'noSearchResults'|'offline'|'dataError';
export function StateIllustration({kind,size=160}:{kind:IllustrationKind;size?:number}){
 return <Image source={Assets.states[kind]} accessible={false} resizeMode="contain" style={{width:size,height:size,maxWidth:'100%',alignSelf:'center'}} />;
}
export { failureIllustration } from '../lib/failureIllustration';
