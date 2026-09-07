import type { ProductCategory } from '../types/product';
import { curatedIngredientProducts } from './curated-ingredient-products';
export const legacyIngredientKeys: Record<string,string>={chicken:'chicken_breast',bread:'wholemeal_bread',oil:'olive_oil',tomatoes:'chopped_tomatoes'};
export const canonicalIngredientKey=(key:string)=>legacyIngredientKeys[key]??key;
export interface IngredientMapping {
  aliases:string[]; allowedCategories:ProductCategory[]; requiredKeywords:string[]; blockedKeywords:string[];
  preferredProductIds?:string[]; preferredBarcodes?:string[];
}
const mapping=(aliases:string[],allowedCategories:ProductCategory[],blockedKeywords:string[]=[],requiredKeywords:string[]=aliases):IngredientMapping=>({aliases,allowedCategories,blockedKeywords,requiredKeywords:[...requiredKeywords]});
/** Concepts, not meal prose or OFF category strings. Curated IDs never bypass safety/form checks. */
export const ingredientMappings:Record<string,IngredientMapping>={
 chicken_breast:mapping(['chicken breast','chicken fillet','chicken breast fillet','hähnchenbrust','hähnchenbrustfilet','haehnchenbrust','hähnchen brustfilet','filet de poulet'],['meat'],['cooked','smoked','roasted','gegart','geräuchert','aufschnitt','cuite','rôti','charcuterie','pané']),
 turkey:mapping(['turkey breast','turkey fillet','putenbrust','putenbrustfilet','putenschnitzel'],['meat'],['cooked','smoked','roasted','gegart','geräuchert','aufschnitt']),
 salmon:mapping(['salmon','salmon fillet','salmon fillets','lachs','lachsfilet','lachsfilets','saumon'],['fish'],['seelachs','pollock','smoked','geräuchert','fumé','crusted','citrus','herb','lemon','teriyaki','kräuter','zitrone']),
 tuna:mapping(['tuna in water','tuna in spring water','tuna in brine','thunfisch','thon au naturel'],['fish'],['oil','öl','huile','steak','fresh','frisch']),
 eggs:mapping(['eggs','egg','eier','ei','freilandeier','bio eier','bodenhaltung'],['eggs'],['chocolate','schokolade','cooked','boiled','gekocht','peeled','powder']),
 tofu:mapping(['tofu','naturtofu','tofu natur'],['legumes','dairy-alternatives','other'],['rella','cheese','käse','smoked','geräuchert','mariniert','silken','seiden','dessert']),
 lentils:mapping(['lentils','lentil','linsen','rote linsen','berglinsen','lentilles'],['legumes'],['cooked','gekocht','canned','dose','ready','rice','reis','oats','hafer','soup','suppe']),
 rice:mapping(['rice','reis','basmati','jasminreis','langkornreis','riz'],['grains'],['cooked','gekocht','microwave','pudding','drink','cake','flour','risotto','ready','quinoa','lentils','linsen','pilau','mexican']),
 pasta:mapping(['pasta','spaghetti','penne','fusilli','nudeln','spirelli','rigatoni'],['pasta'],['filled','füllung','lasagn','tortell','ravioli','cooked','gekocht']),
 potatoes:mapping(['potato','potatoes','kartoffel','kartoffeln','speisekartoffeln'],['potatoes','vegetables'],['chips','crisps','fries','mashed','püree','fried','gratin','sliced new']),
 wholemeal_bread:mapping(['wholemeal bread','whole wheat bread','wholegrain bread','whole grain bread','vollkornbrot','vollkorntoast','weizenvollkornbrot'],['bread'],['sweet','raisins','rosinen']),
 broccoli:mapping(['broccoli','brokkoli','brokkoliröschen'],['vegetables'],['carrot','karotte','blumenkohl','cauliflower','corn','beans','gratin','mix','mischung']),
 carrots:mapping(['carrot','carrots','karotten','karotte','möhren','möhre','mohren'],['vegetables'],['juice','saft','cake','kuchen','mix','mischung','broccoli']),
 spinach:mapping(['spinach','spinat','blattspinat','babyspinat'],['vegetables'],['cream','rahm','sahne','creme']),
 chopped_tomatoes:mapping(['chopped tomatoes','diced tomatoes','canned tomatoes','gehackte tomaten','stückige tomaten','tomaten stücke','tomatenstücke','tomates concassées'],['vegetables'],['chilies','chilli','garlic','knoblauch','olive oil','basil','basilikum']),
 olive_oil:mapping(['olive oil','olivenöl','olivenoel','huile d olive'],['other'],['herb','kräuter','garlic','knoblauch','blend','mischung']),
 oats:mapping(['rolled oats','oat flakes','oats','haferflocken','hafer flocken','flocons d avoine'],['breakfast','grains'],['granola','bar','riegel','muesli','müsli','frosted','honey','honig','instant oatmeal']),
 chickpeas:mapping(['chickpeas','chickpea','kichererbsen','pois chiches'],['legumes'],['flour','mehl','roasted','geröstet','snack','hummus','dry','getrocknet']),
 berries:mapping(['blueberries','blaubeeren','heidelbeeren','mixed berries','beerenmischung','strawberries','erdbeeren','himbeeren'],['fruit'],['dried','jam','syrup','confiture','getrocknet','chocolate','schokolade']),
 banana:mapping(['banana','bananas','banane','bananen'],['fruit'],['chips','dried','getrocknet','juice','saft','puree','püree','powder','berries','strawberry']),
 apple:mapping(['apple','apples','apfel','äpfel'],['fruit'],['dried','getrocknet','sauce','mus','juice','saft','chips','cinnamon']),
 yogurt:mapping(['greek yogurt','greek yoghurt','griechischer joghurt','joghurt griechischer art','joghurt nach griechischer art'],['dairy'],['honey','honig','fruit','frucht','vanille','vanilla']),
 cottage:mapping(['cottage cheese','hüttenkäse','körniger frischkäse'],['dairy'],['pineapple','ananas','fruit','frucht']),
};
export const preparedFoodKeywords=['soup','suppe','sauce','salad','salat','sandwich','burger','nuggets','dessert','meal','pizza','seasoned','marinated','breaded','paniert','gewürzt','waffeln','waffles','curry','eintopf','cakes','cake','chips','crisps'];
ingredientMappings.chicken_breast.blockedKeywords.push('kirschpaprika','paprika');
ingredientMappings.chickpeas.blockedKeywords.push('quinoa','gemüse','erdnuss');
ingredientMappings.chopped_tomatoes.requiredKeywords.push('tomaten gehackt','tomaten stückig','tomaten stücken');
ingredientMappings.wholemeal_bread.requiredKeywords.push('vollkorn toast');
ingredientMappings.carrots.aliases.push('carotte','karottini','snackmöhren');
for(const [key,entry] of Object.entries(curatedIngredientProducts))ingredientMappings[key].preferredBarcodes=entry.barcodes;
