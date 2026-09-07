/** Reviewed OFF identities, 2026-09-07. Mappings never bypass safety or invent package facts. */
export const curatedIngredientProducts:Record<string,{barcodes:string[];evidence:string}>={
 chicken_breast:{barcodes:['4061458010627','4337256098779'],evidence:'Fresh chicken breast pieces; both source records declare 600 g, without cooked/cured ingredient markers.'},
 salmon:{barcodes:['4009239512298','4061458024105'],evidence:'Plain salmon fillet; source quantities 250 g and 300 g.'},
 eggs:{barcodes:['0029653831007'],evidence:'Egg Ranch cage-free eggs, ingredients large brown eggs; source package 24 oz. No count-to-mass assumption.'},
 tofu:{barcodes:['0018513003388'],evidence:'Plain Tofu, 14 oz (396 g); not Tofu rella cheese substitute. Missing ingredient/diet details retain uncertainty.'},
 lentils:{barcodes:['4056489032090'],evidence:'Lentilles vertes, ingredient green lentils, declared 500 g dry package.'},
 rice:{barcodes:['4056489095736','4056489845171','4061458002684'],evidence:'Plain dry basmati/jasmine rice; 500 g / 1 kg source packages.'},
 pasta:{barcodes:['0015100001635','0012700158042','0015100002366'],evidence:'Plain dry spaghetti/penne; semolina/wheat ingredients and declared mass.'},
 potatoes:{barcodes:['0033383530505'],evidence:'Russet potatoes, source 10 lb package; large pack is penalized by leftover scoring.'},
 wholemeal_bread:{barcodes:['4009249019923','4061458045759'],evidence:'Vollkorntoast, both declared 500 g.'},
 broccoli:{barcodes:['4061458248129','4250241204668','4337256109505'],evidence:'Plain Brokkoli, 500 g / 400 g / 300 g. Vegetable mixtures excluded.'},
 carrots:{barcodes:['0000000258258'],evidence:'Carrots; existing source declares 1 kg.'},
 spinach:{barcodes:['4061462123528','4250241202848','4311501428184'],evidence:'Plain leaf/young spinach; 350 g / 500 g / 450 g. Creamed spinach excluded.'},
 chopped_tomatoes:{barcodes:['4061459112061','0000020004132'],evidence:'Chopped tomatoes in tomato juice, 400 g; not sauce or flavoured meal.'},
 olive_oil:{barcodes:['4104420248823'],evidence:'Bio olive oil, source declares 458 g. No ml-to-g density assumption.'},
 oats:{barcodes:['4000540000306','4000540000641','0000020283360'],evidence:'Plain oat flakes, 500 g packages; sweetened cereal excluded.'},
 cottage:{barcodes:['4337256112925'],evidence:'Köriger Frischkäse is a spelling variant of cottage cheese; source still checked for dairy restrictions.'},
};
