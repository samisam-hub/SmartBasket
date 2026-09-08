import {Image,View} from 'react-native';
import {Assets} from '../lib/assets';
export function BrandLogo({compact=false,dark=false}:{compact?:boolean;dark?:boolean}){
 return <View style={{paddingVertical:compact?8:12,paddingHorizontal:compact?8:12,alignSelf:'flex-start',maxWidth:'100%'}}><Image source={compact?Assets.brand.logoMark:dark?Assets.brand.logoHorizontalDark:Assets.brand.logoHorizontal} accessibilityLabel="SmartBasket" resizeMode="contain" style={compact?{width:40,height:40}:{width:220,height:55,maxWidth:'100%'}} /></View>;
}
export type IllustrationKind='emptyBasket'|'noSearchResults'|'offline'|'dataError';
export function StateIllustration({kind,size=160}:{kind:IllustrationKind;size?:number}){
 return <Image source={Assets.states[kind]} accessible={false} resizeMode="contain" style={{width:size,height:size,maxWidth:'100%',alignSelf:'center'}} />;
}
export { failureIllustration } from '../lib/failureIllustration';
