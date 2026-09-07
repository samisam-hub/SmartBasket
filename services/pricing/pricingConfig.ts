import type { ProductCategory } from '../../types/product';
/** Invented development reference rates in EUR, NOT surveyed or live retailer prices. */
export const pricingConfig = {
  version: 'synthetic-mvp-1', minimumPackagePrice: 0.35, maximumPackagePrice: 1000,
  types: [
    { key:'chicken', categories:['meat'], words:/chicken|hahnchen|huhner|poulet/, kg:12 },
    { key:'salmon', categories:['fish'], words:/salmon|lachs|saumon/, kg:22 },
    { key:'tuna', categories:['fish'], words:/tuna|thunfisch|thon/, kg:12 },
    { key:'tofu', categories:['legumes','dairy-alternatives'], words:/tofu/, kg:6 },
    { key:'lentils', categories:['legumes'], words:/lentil|linsen|lentill/, kg:3 },
    { key:'rice', categories:['grains'], words:/rice|reis|riz/, kg:3 },
    { key:'olive_oil', categories:['other'], words:/olive oil|olivenol|huile d olive/, kg:11, liter:10 },
    { key:'oats', categories:['breakfast','grains'], words:/oat|hafer|avoine/, kg:2.4 },
    { key:'almond_milk', categories:['dairy-alternatives','beverages'], words:/almond|mandel|amande/, liter:2 },
    { key:'canned_tomatoes', categories:['vegetables'], words:/chopped|diced|gehackt|stuckig|tomaten.*dose/, kg:2.5 },
  ] as {key:string;categories:ProductCategory[];words:RegExp;kg?:number;liter?:number;piece?:number}[],
  categories: {
    fruit:{kg:3}, vegetables:{kg:3}, meat:{kg:12}, fish:{kg:18}, eggs:{kg:6,piece:0.32},
    dairy:{kg:4,liter:1.5}, 'dairy-alternatives':{kg:5,liter:2}, bread:{kg:4}, grains:{kg:3},
    pasta:{kg:2.5}, potatoes:{kg:1.5}, legumes:{kg:3}, breakfast:{kg:4}, snacks:{kg:10},
    beverages:{liter:1.5}, other:{},
  } satisfies Record<ProductCategory,{kg?:number;liter?:number;piece?:number}>,
};
