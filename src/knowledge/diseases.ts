/**
 * Curated crop-disease knowledge base. This is the ONLY set of diagnoses the
 * agent may return, so treatments are grounded and never invented.
 *
 * Treatments are common Indian recommendations. The agent always advises
 * consulting a local Krishi Vigyan Kendra / agriculture officer for exact
 * doses and safe periods.
 */

export interface DiseaseEntry {
  crop: string;
  name: string; // English name
  hindi: string; // Hindi/Hinglish name
  symptoms: string[]; // visible symptoms, short
  organic: string; // organic / non-chemical first step
  chemical: string; // chemical treatment (with caution)
  prevention: string;
}

export const DISEASES: DiseaseEntry[] = [
  // ---------------- Tomato ----------------
  {
    crop: "tomato",
    name: "Early Blight",
    hindi: "Shuruaati jhulsa",
    symptoms: ["Purane patton pe brown dhabbe", "Dhabbon pe concentric rings", "Peele kinare", "Neeche se patte jhadte hain"],
    organic: "Neem oil 2ml/L har 7 din spray karein. Copper-based spray bhi kaam karta hai.",
    chemical: "Mancozeb 75% WP 2g/L, 7-10 din ke antar se spray. Exact dose ke liye kisaan bhaai, apne kshetriya krishi adhikari se milen.",
    prevention: "Fasal rotation karein, patte gile hone se bachayen (sirf jad mein paani), rogi patte hatayen.",
  },
  {
    crop: "tomato",
    name: "Late Blight",
    hindi: "Der se jhulsa",
    symptoms: ["Patton pe paani jaisa geela daag", "Patte ke niche safed phaphundi", "Tana aur phal bhi gala jaata hai"],
    organic: "Copper oxychloride spray. Bahut rogi poudhe ko ukhaad kar jala dein.",
    chemical: "Metalaxyl + Mancozeb (jaise Ridomil Gold) spray. Baarish ke mausam mein jaldi karein.",
    prevention: "Hawadar duri par planting, shaam ko paani nahi, rogi patte turant hatayen.",
  },
  {
    crop: "tomato",
    name: "Leaf Curl Virus",
    hindi: "Patta mudna",
    symptoms: ["Patte upar mud jaate hain", "Patta peela aur chhota", "Poudha thikanta nahi", "Phal kam"],
    organic: "Whitefly rokne ke liye yellow sticky trap aur neem oil lagayen.",
    chemical: "Whitefly ke liye Imidacloprid 0.3ml/L spray. Virus ka koi ilaaj nahi, rogi poudhe nikaal dein.",
    prevention: "Whitefly ko control rakhen, resistant variety lagayen.",
  },
  {
    crop: "tomato",
    name: "Fusarium Wilt",
    hindi: "Mala rog / murjhana",
    symptoms: ["Neeche ke patte peele hokar murjhaate hain", "Tana katne par andar se bhura", "Aadha poudha pehle murjhata hai"],
    organic: "Mitti mein neem khali milayen. Mitti ko dhoop mein solarize karein.",
    chemical: "Carbendazim 0.1% jad mein drench. Mitti mein Trichoderma milayen.",
    prevention: "3-4 saal rotation, resistant variety, paani ki achhi nikasi.",
  },
  {
    crop: "tomato",
    name: "Bacterial Wilt",
    hindi: "Bacteriyai murjhana",
    symptoms: ["Achanak pura poudha murjhata hai", "Patte peele nahi hote", "Tana katne par pani sa nikalta hai"],
    organic: "Rogi poudhe ukhaad kar nikaal dein. Rotation rakhen.",
    chemical: "Koi pukhta ilaaj nahi. Mitti mein copper drench karein, baaki poudhe bachayen.",
    prevention: "Resistant variety, saaf aujaar, jagah badal kar lagana.",
  },
  {
    crop: "tomato",
    name: "Septoria Leaf Spot",
    hindi: "Patta dhabbe",
    symptoms: ["Chhote grey dhabbe beech mein kaale", "Neeche ke patte pehle", "Patte peele hokar girte hain"],
    organic: "Copper spray har 10 din. Girte patte saaf karein.",
    chemical: "Mancozeb 2g/L spray 7-10 din mein.",
    prevention: "Poudhe bandhkar lagayen, paani jad mein dein, khali patte hatayen.",
  },
  {
    crop: "tomato",
    name: "Blossom End Rot",
    hindi: "Phal ke niche kaala paani",
    symptoms: ["Phal ke neeche kaala, dhansila daag", "Dabane par naram", "Kaalsium ki kami se hota hai"],
    organic: "Mitti mein gypsum/liming se calcium badhayein. Paani niyamit dein.",
    chemical: "Calcium nitrate 1% foliar spray. Paani ki kami na hone dein.",
    prevention: "Paani barabar rakhen, mitti mein calcium, mulch karein.",
  },
  {
    crop: "tomato",
    name: "Fruit Borer",
    hindi: "Phal ka keeda",
    symptoms: ["Phal mein gol suraakh", "Andar se phal khaya hua", "Caterpillar dikhta hai"],
    organic: "Neem-based spray, keede haath se chunein, pheromone trap lagayen.",
    chemical: "Emamectin benzoate 0.4g/L ya Spinosad spray. Khaye hue phal toden.",
    prevention: "Trap lagayen, rogi phal hatayen, fasal rotation.",
  },

  // ---------------- Potato ----------------
  {
    crop: "potato",
    name: "Late Blight",
    hindi: "Der se jhulsa",
    symptoms: ["Patton pe geela bhura daag", "Neeche safed phaphundi", "Kand bhi galte hain"],
    organic: "Rogi patte turant hatayen, copper spray.",
    chemical: "Metalaxyl + Mancozeb spray. Baarish ke pehle preventively karein.",
    prevention: "Resistant variety, hawadar duri, bheege patte na rakhne den.",
  },
  {
    crop: "potato",
    name: "Early Blight",
    hindi: "Shuruaati jhulsa",
    symptoms: ["Patton pe brown rings wale dhabbe", "Neeche se patte girte hain"],
    organic: "Neem oil 2ml/L har 7 din.",
    chemical: "Mancozeb 2g/L, 10 din ke antar se.",
    prevention: "Rotation, rogi patte hatayen.",
  },
  {
    crop: "potato",
    name: "Black Scurf",
    hindi: "Kand ka kaala rog",
    symptoms: ["Kand pe kaali kharandi", "Jad ke paas tane pe zakhmi dhabbe"],
    organic: "Healthy beej chunein, rotation karein.",
    chemical: "Beej treatment Carbendazim ya Mancozeb se karein.",
    prevention: "Certified beej, ek hi jagah baar baar potato na lagayen.",
  },
  {
    crop: "potato",
    name: "Common Scab",
    hindi: "Khurandi",
    symptoms: ["Kand pe khurdura cork jaisa daag", "Upar ki chaal pheet jaati hai"],
    organic: "Mitti ki acidity theek rakhein, taza khaad na dein.",
    chemical: "Koi seedha ilaaj nahi, resistant variety use karein.",
    prevention: "Rotation, beej healthy rakhein.",
  },

  // ---------------- Rice ----------------
  {
    crop: "rice",
    name: "Rice Blast",
    hindi: "Blast jhulsa",
    symptoms: ["Patton pe grey beech wali lambi dhabbi", "Balli ke gale pe kaala daag", "Dane khokhle"],
    organic: "Nitrogen zyada na dein, straw/mitti mein silicon milayen.",
    chemical: "Tricyclazole 0.06% ya Isoprothiolane spray. Bail lagne par turant.",
    prevention: "Resistant variety, santulit khaad.",
  },
  {
    crop: "rice",
    name: "Brown Spot",
    hindi: "Bhure dhabbe",
    symptoms: ["Patton pe oval bhure dhabbe", "Peele ghere", "Patte sookh jaate hain"],
    organic: "Potassium aur santulit khaad dein.",
    chemical: "Carbendazim + Mancozeb (combiproduct) 2.5g/L spray.",
    prevention: "Healthy beej, potassium ki kami na hone dein.",
  },
  {
    crop: "rice",
    name: "Bacterial Leaf Blight",
    hindi: "Patta jhulsa",
    symptoms: ["Patton ke kinare peele-safed leher", "Patta sookhkar kat-ta hua lagta hai", "Subah oos jaisa chikna"],
    organic: "Early stage mein gehre paani se bachayen.",
    chemical: "Copper oxychloride spray. Kisaan bhaai, exact dawai ke liye krishi adhikari se milen.",
    prevention: "Resistant variety, paani ka utaar-chadhaav sahi rakhein.",
  },
  {
    crop: "rice",
    name: "Sheath Blight",
    hindi: "Tave ka jhulsa",
    symptoms: ["Tave pe hari-bhuri dhabbi", "Dhabbi upar chadh jaati hai", "Balli pe grey safed jhili"],
    organic: "Ghanapan kam karein, nitrogen zyada na dein.",
    chemical: "Hexaconazole 1ml/L ya Validamycin spray.",
    prevention: "Fasal ki doori sahi rakhein, potassium dein.",
  },

  // ---------------- Wheat ----------------
  {
    crop: "wheat",
    name: "Yellow Rust",
    hindi: "Peela ratua",
    symptoms: ["Patton pe peeli dhariyan", "Dhabbe pitti jaise", "Thande-gile mausam mein zyada"],
    organic: "Jaldi boyai karein, nitrogen zyada na dein.",
    chemical: "Propiconazole 1ml/L ya Triadimefon spray. February mein nazar rakhein.",
    prevention: "Resistant variety, rogi poudhe jalayen.",
  },
  {
    crop: "wheat",
    name: "Brown Rust",
    hindi: "Bhura ratua",
    symptoms: ["Patton pe gol bhure dhabbe", "Dhabbe chidko ki tarah"],
    organic: "Resistant variety lagayen.",
    chemical: "Propiconazole 1ml/L spray.",
    prevention: "Resistant variety, saaf khet.",
  },
  {
    crop: "wheat",
    name: "Black Rust",
    hindi: "Kala ratua",
    symptoms: ["Tane aur patton pe kaale dhabbe", "Fasal pakne ke waqt zyada"],
    organic: "Jaldi boyai karein, beech ke rogi poudhe hatayen.",
    chemical: "Propiconazole ya Mancozeb spray.",
    prevention: "Resistant variety, nali se paani ki achhi nikasi.",
  },
  {
    crop: "wheat",
    name: "Powdery Mildew",
    hindi: "Churni phuphendi",
    symptoms: ["Patton pe safed churna", "Patta peela hokar sookhta hai"],
    organic: "Ghana boyai na karein, hawadari rakhein.",
    chemical: "Sulfur 2g/L spray.",
    prevention: "Resistant variety, duri sahi rakhein.",
  },

  // ---------------- Chilli ----------------
  {
    crop: "chilli",
    name: "Anthracnose",
    hindi: "Phal galana",
    symptoms: ["Phal pe dhasila kaala daag", "Daag pe goltas ke rings", "Phal sukhar girta hai"],
    organic: "Neem oil spray, patte aur phal gile na karein.",
    chemical: "Phool lagne par Copper oxychloride 0.3% ya Mancozeb. Carbendazim bhi kaam karta hai.",
    prevention: "Saaf beej, rogi phal hatayen, rotation.",
  },
  {
    crop: "chilli",
    name: "Leaf Curl Virus",
    hindi: "Patta mudna",
    symptoms: ["Patte mud jaate hain", "Poudha thikanta nahi", "Phal chhote aur tedhe"],
    organic: "Yellow sticky trap, neem oil se whitefly rokhein.",
    chemical: "Whitefly ke liye Imidacloprid. Virus ka koi ilaaj nahi, rogi poudhe nikalein.",
    prevention: "Whitefly control, resistant variety.",
  },
  {
    crop: "chilli",
    name: "Powdery Mildew",
    hindi: "Churni phuphendi",
    symptoms: ["Patton pe safed churna", "Patte peele hokar girte hain"],
    organic: "Hawadar duri, patte gile na rakhein.",
    chemical: "Sulfur 2g/L ya Wettable sulfur spray.",
    prevention: "Resistant variety, duri sahi rakhein.",
  },
  {
    crop: "chilli",
    name: "Cercospora Leaf Spot",
    hindi: "Patta dhabbe",
    symptoms: ["Patton pe gol chhote dhabbe", "Beech grey, kinara bhura", "Patte jhad jaate hain"],
    organic: "Copper spray, girte patte saaf karein.",
    chemical: "Mancozeb 2g/L ya Chlorothalonil spray.",
    prevention: "Rotation, rogi patte hatayen.",
  },

  // ---------------- Brinjal ----------------
  {
    crop: "brinjal",
    name: "Bacterial Wilt",
    hindi: "Murjhana",
    symptoms: ["Achanak pura poudha murjhata hai", "Tana katne par pani sa nikalta hai"],
    organic: "Rogi poudhe nikaal kar jala dein, rotation.",
    chemical: "Koi pukhta ilaaj nahi. Copper drench, resistant grafted variety.",
    prevention: "Resistant variety (grafted), saaf aujaar, jagah badalna.",
  },
  {
    crop: "brinjal",
    name: "Phomopsis Blight",
    hindi: "Phal sadna",
    symptoms: ["Phal pe gol halke dhabbe", "Phal andar se bhura", "Patte pe bhi dhabbe"],
    organic: "Rogi phal hatayen, rotation karein.",
    chemical: "Mancozeb ya Carbendazim spray, phal lagne ke baad.",
    prevention: "Healthy beej, phal bheetar na rakhein zyada der.",
  },
  {
    crop: "brinjal",
    name: "Little Leaf",
    hindi: "Patta chhota rog",
    symptoms: ["Patte bahut chhote", "Poudha jhaad jaisa", "Phal nahi lagta"],
    organic: "Leafhopper ke liye yellow trap lagayen.",
    chemical: "Leafhopper ke liye Imidacloprid spray. Rogi poudhe nikaal dein.",
    prevention: "Vector control, resistant variety.",
  },

  // ---------------- Okra ----------------
  {
    crop: "okra",
    name: "Yellow Vein Mosaic Virus",
    hindi: "Peeli nas rog",
    symptoms: ["Patton pe peeli nas ka jaal", "Patta peela", "Phal chhote aur seedhe nahi"],
    organic: "Yellow sticky trap, neem oil se whitefly rokhein.",
    chemical: "Whitefly ke liye Imidacloprid. Virus ka koi ilaaj nahi, rogi poudhe nikaalein.",
    prevention: "Whitefly control, resistant variety, saaf khet.",
  },
  {
    crop: "okra",
    name: "Powdery Mildew",
    hindi: "Churni phuphendi",
    symptoms: ["Patton pe safed churna", "Patte peele hokar girte hain"],
    organic: "Hawadari rakhein, patte gile na karein.",
    chemical: "Sulfur 2g/L spray.",
    prevention: "Resistant variety, duri sahi.",
  },
  {
    crop: "okra",
    name: "Fusarium Wilt",
    hindi: "Murjhana",
    symptoms: ["Neeche ke patte peele hokar murjhaate hain", "Tana andar se bhura"],
    organic: "Rotation, neem khali mitti mein.",
    chemical: "Carbendazim drench, Trichoderma mitti mein.",
    prevention: "3-4 saal rotation, resistant variety.",
  },

  // ---------------- Maize ----------------
  {
    crop: "maize",
    name: "Common Rust",
    hindi: "Jhulsa",
    symptoms: ["Patton pe darchini jaisa bhura chidka", "Dhabbe gol", "Patte sookhte hain"],
    organic: "Rogi patte hatayen, resistant hybrid lagayen.",
    chemical: "Mancozeb ya Propiconazole spray.",
    prevention: "Resistant hybrid, rotation.",
  },
  {
    crop: "maize",
    name: "Turcicum Leaf Blight",
    hindi: "Patta jhulsa",
    symptoms: ["Patton pe lambi grey-bhuri dhabbi", "Dhabbi veins ke parallel", "Patte jhad jaate hain"],
    organic: "Fasal rotation, rogi patte saaf karein.",
    chemical: "Mancozeb 2g/L ya Chlorothalonil spray.",
    prevention: "Resistant hybrid, rotation.",
  },
  {
    crop: "maize",
    name: "Grey Leaf Spot",
    hindi: "Matti dhabbe",
    symptoms: ["Patton pe chaukonde grey dhabbe", "Dhabbe veins ke parallel", "Patte peele hokar girte hain"],
    organic: "Rotation, ghana boyai na karein.",
    chemical: "Propiconazole 1ml/L spray.",
    prevention: "Resistant hybrid, mitti ki nikasi sahi.",
  },

  // ---------------- Mango ----------------
  {
    crop: "mango",
    name: "Powdery Mildew",
    hindi: "Churni phuphendi",
    symptoms: ["Phoolon pe safed churna", "Phool jhad jaate hain", "Chhote phal bhi girte hain"],
    organic: "Phool lagne ke samay neem spray.",
    chemical: "Sulfur 2g/L ya Dinocap spray, mawari (panicle) lagte hi.",
    prevention: "Pehla spray phool khilne se pehle karein.",
  },
  {
    crop: "mango",
    name: "Anthracnose",
    hindi: "Phal sadna",
    symptoms: ["Phal pe kaale dhabbe", "Patte pe bhi kaale daag", "Phal andar se galta hai"],
    organic: "Rogi tukde kaat kar hatayen, copper spray.",
    chemical: "Copper oxychloride 0.3% ya Carbendazim spray, phool lagne ke baad.",
    prevention: "Chhanti karein, rogi phal/patte saaf karein.",
  },

  // ---------------- Cotton ----------------
  {
    crop: "cotton",
    name: "Leaf Curl Virus",
    hindi: "Patta mudna",
    symptoms: ["Patte mud jaate hain", "Poudha thikanta nahi", "Phal kam"],
    organic: "Whitefly rokne ke liye yellow trap, neem oil.",
    chemical: "Whitefly ke liye Imidacloprid. Virus ka ilaaj nahi, rogi poudhe nikaalein.",
    prevention: "Whitefly control, resistant variety.",
  },
  {
    crop: "cotton",
    name: "Bacterial Blight",
    hindi: "Kona dhabbe",
    symptoms: ["Patton pe paani jaisa kona dhabba", "Dhabbe bhure hokar sukh jaate hain", "Tane pe bhi dhabba"],
    organic: "Saaf beej (acid-delinted), rotation.",
    chemical: "Copper oxychloride spray. Exact dose ke liye krishi adhikari se milen.",
    prevention: "Resistant variety, saaf beej.",
  },
  {
    crop: "cotton",
    name: "Alternaria Leaf Spot",
    hindi: "Patta dhabbe",
    symptoms: ["Patton pe bhure dhabbe", "Dhabbon ke kinare kaale", "Patte jhad jaate hain"],
    organic: "Rogi patte hatayen, rotation.",
    chemical: "Mancozeb 2g/L spray.",
    prevention: "Rotation, resistant variety.",
  },

  // ---------------- Onion ----------------
  {
    crop: "onion",
    name: "Purple Blotch",
    hindi: "Baingani dhabbe",
    symptoms: ["Pattiyon pe grey-baingani dhabbe", "Dhabbon pe golte", "Patti ki nok sookh jaati hai"],
    organic: "Neem oil spray, upar se paani na dalein.",
    chemical: "Mancozeb 2g/L ya Chlorothalonil spray, 10 din ke antar se.",
    prevention: "Rotation, healthy bulb se lagayen, nitrogen zyada na dein.",
  },
  {
    crop: "onion",
    name: "Downy Mildew",
    hindi: "Phuphendi rog",
    symptoms: ["Pattiyon pe halke peeche dhabbe", "Dhabbon pe grey-baingani chikni jhili", "Pattiyan peeli hokar jhuk jaati hain"],
    organic: "Fasal ki doori badhayein, shaam ko paani na dein.",
    chemical: "Metalaxyl + Mancozeb spray. Gile mausam mein turant.",
    prevention: "Hawadari, saaf beej, rotation.",
  },
];

/** Sanity guard: every crop with synonyms must have at least one entry. */
export const CROPS_COVERED: string[] = [...new Set(DISEASES.map((d) => d.crop))];
