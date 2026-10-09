import json, re, sys, os
from nltk.corpus import wordnet

sys.stdout.reconfigure(encoding='utf-8')

print("Starting Enhanced Oxford 5000 Builder...")

# 1. Parse Lexitron XML
print("Loading Lexitron (etlex.xml)...")
with open('etlex.xml', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

docs = re.findall(r'<Doc>(.*?)</Doc>', content, re.DOTALL)
print(f"Total Lexitron docs: {len(docs)}")

lex_dict = {}
for doc in docs:
    esearch = re.search(r'<esearch>(.*?)</esearch>', doc)
    if not esearch:
        continue
    word = esearch.group(1).strip().lower()
    tentry = re.search(r'<tentry>(.*?)</tentry>', doc)
    ethai = re.search(r'<ethai>(.*?)</ethai>', doc)
    ecat = re.search(r'<ecat>(.*?)</ecat>', doc)
    esyn = re.search(r'<esyn>(.*?)</esyn>', doc)
    eant = re.search(r'<eant>(.*?)</eant>', doc)
    
    t_val = tentry.group(1).strip() if tentry else ""
    th_val = ethai.group(1).strip() if ethai else ""
    cat_val = ecat.group(1).strip() if ecat else ""
    syn_val = esyn.group(1).strip() if esyn else ""
    ant_val = eant.group(1).strip() if eant else ""
    
    if word not in lex_dict:
        lex_dict[word] = []
    lex_dict[word].append({
        'tentry': t_val,
        'ethai': th_val,
        'cat': cat_val,
        'syn': [s.strip().rstrip(';') for s in syn_val.split(';') if s.strip()] if syn_val else [],
        'ant': [a.strip().rstrip(';') for a in ant_val.split(';') if a.strip()] if ant_val else []
    })

# 2. Hand-crafted mapping for unmatched/modern words
UNMATCHED_DICT = {
    'a': {'th': 'หนึ่ง (คำนำหน้าคำนามไม่ชี้เฉพาะ)', 'syn': ['an', 'one'], 'ant': [], 'topic': 'Grammar & Functional'},
    'accountability': {'th': 'ความรับผิดชอบต่อผลงาน, ภาระรับผิดชอบ', 'syn': ['responsibility', 'answerability', 'liability'], 'ant': ['irresponsibility'], 'topic': 'Business & Work'},
    'activation': {'th': 'การเปิดใช้งาน, การกระตุ้นการทำงาน', 'syn': ['triggering', 'initiation', 'starting'], 'ant': ['deactivation'], 'topic': 'Science & Technology'},
    'addiction': {'th': 'การเสพติด, ความหมกมุ่น', 'syn': ['dependence', 'habit', 'obsession'], 'ant': ['independence'], 'topic': 'Health & Medicine'},
    'additionally': {'th': 'นอกจากนี้, ยิ่งไปกว่านั้น', 'syn': ['furthermore', 'moreover', 'besides'], 'ant': [], 'topic': 'General Communication'},
    'affordable': {'th': 'ราคาจับต้องได้, สามารถจ่ายได้', 'syn': ['inexpensive', 'reasonable', 'economical'], 'ant': ['expensive', 'unaffordable'], 'topic': 'Business & Work'},
    'annually': {'th': 'เป็นประจำทุกปี, ปีละครั้ง', 'syn': ['yearly', 'per annum'], 'ant': [], 'topic': 'General & Daily Life'},
    'any more': {'th': 'อีกต่อไป, ไม่...อีกแล้ว', 'syn': ['any longer', 'nowadays'], 'ant': [], 'topic': 'General Communication'},
    'architectural': {'th': 'ทางสถาปัตยกรรม, เกี่ยวกับการออกแบบอาคาร', 'syn': ['structural', 'constructional'], 'ant': [], 'topic': 'Arts, Media & Entertainment'},
    'arguably': {'th': 'อย่างอาจกล่าวได้ว่า, พอจะพูดได้ว่า', 'syn': ['plausibly', 'probably', 'possibly'], 'ant': ['unquestionably'], 'topic': 'General Communication'},
    'artwork': {'th': 'งานศิลปะ, ภาพประกอบ', 'syn': ['art', 'masterpiece', 'illustration'], 'ant': [], 'topic': 'Arts, Media & Entertainment'},
    'atrocity': {'th': 'ความโหดร้ายทารุณ, การกระทำอันป่าเถื่อน', 'syn': ['cruelty', 'barbarity', 'outrage'], 'ant': ['kindness', 'mercy'], 'topic': 'Law, Society & Politics'},
    'availability': {'th': 'ความพร้อมใช้งาน, การมีอยู่, ความสะดวก', 'syn': ['accessibility', 'readiness', 'presence'], 'ant': ['unavailability'], 'topic': 'Business & Work'},
    'blog': {'th': 'บล็อก, เว็บบันทึกเรื่องราวออนไลน์', 'syn': ['weblog', 'journal', 'vlog'], 'ant': [], 'topic': 'Science & Technology'},
    'broadband': {'th': 'บรอดแบนด์, อินเทอร์เน็ตความเร็วสูง', 'syn': ['high-speed internet', 'bandwidth'], 'ant': ['dial-up'], 'topic': 'Science & Technology'},
    'cabin': {'th': 'กระท่อมไม้, ห้องพักในเรือ/เครื่องบิน', 'syn': ['cottage', 'hut', 'lodge'], 'ant': [], 'topic': 'Travel & Transportation'},
    'camping': {'th': 'การตั้งแคมป์, การพักแรมกลางแจ้ง', 'syn': ['encampment', 'bivouac', 'backpacking'], 'ant': [], 'topic': 'Travel & Transportation'},
    'cannot': {'th': 'ไม่สามารถ, ทำไม่ได้', 'syn': ['unable', 'powerless'], 'ant': ['can', 'able'], 'topic': 'General Communication'},
    'civilian': {'th': 'พลเรือน, คนธรรมดาที่ไม่ใช่ทหารหรือตำรวจ', 'syn': ['non-military', 'citizen', 'private citizen'], 'ant': ['military', 'soldier'], 'topic': 'Law, Society & Politics'},
    'closely': {'th': 'อย่างใกล้ชิด, อย่างละเอียดถี่ถ้วน', 'syn': ['intimately', 'tightly', 'attentively'], 'ant': ['distantly', 'loosely'], 'topic': 'General Communication'},
    'commentator': {'th': 'ผู้วิจารณ์, ผู้บรรยาย, นักพากย์', 'syn': ['analyst', 'critic', 'broadcaster'], 'ant': [], 'topic': 'Arts, Media & Entertainment'},
    'commissioner': {'th': 'ข้าหลวง, กรรมาธิการ, ผู้ตรวจการ', 'syn': ['official', 'delegate', 'representative'], 'ant': [], 'topic': 'Law, Society & Politics'},
    'congressional': {'th': 'เกี่ยวกับรัฐสภา', 'syn': ['parliamentary', 'legislative'], 'ant': [], 'topic': 'Law, Society & Politics'},
    'considerably': {'th': 'อย่างมาก, อย่างเห็นได้ชัด', 'syn': ['substantially', 'significantly', 'greatly'], 'ant': ['slightly', 'barely'], 'topic': 'General Communication'},
    'consistently': {'th': 'อย่างสม่ำเสมอ, เสมอต้นเสมอปลาย', 'syn': ['regularly', 'constantly', 'persistently'], 'ant': ['inconsistently'], 'topic': 'General Communication'},
    'constantly': {'th': 'ตลอดเวลา, อย่างต่อเนื่องไม่หยุดหย่อน', 'syn': ['continuously', 'incessantly', 'always'], 'ant': ['rarely', 'seldom'], 'topic': 'General Communication'},
    'coordinator': {'th': 'ผู้ประสานงาน', 'syn': ['organizer', 'facilitator', 'director'], 'ant': [], 'topic': 'Business & Work'},
    'counselling': {'th': 'การให้คำปรึกษา, การแนะแนว', 'syn': ['guidance', 'therapy', 'advising'], 'ant': [], 'topic': 'Health & Medicine'},
    'credibility': {'th': 'ความน่าเชื่อถือ, ความไว้วางใจได้', 'syn': ['believability', 'reliability', 'trustworthiness'], 'ant': ['unreliability'], 'topic': 'Business & Work'},
    'cynical': {'th': 'มองโลกในแง่ร้าย, ไม่เชื่อในความจริงใจของผู้อื่น', 'syn': ['skeptical', 'distrustful', 'pessimistic'], 'ant': ['optimistic', 'trusting'], 'topic': 'Emotions & Personality'},
    'darkness': {'th': 'ความมืด, ความมืดมิด', 'syn': ['blackness', 'gloom', 'shadow'], 'ant': ['light', 'brightness'], 'topic': 'Nature & Environment'},
    'dealer': {'th': 'ผู้แทนจำหน่าย, พ่อค้าคนกลาง', 'syn': ['trader', 'merchant', 'distributor'], 'ant': ['buyer', 'consumer'], 'topic': 'Business & Work'},
    'decision-making': {'th': 'การตัดสินใจ, กระบวนการวินิจฉัย', 'syn': ['determination', 'judgment', 'resolving'], 'ant': ['indecision'], 'topic': 'Business & Work'},
    'defender': {'th': 'ผู้พิทักษ์, กองหลัง (กีฬา)', 'syn': ['protector', 'guardian', 'back'], 'ant': ['attacker', 'forward'], 'topic': 'Sports & Recreation'},
    'dependent': {'th': 'ขึ้นอยู่กับ, ผู้อยู่ในความอุปการะ', 'syn': ['relying', 'conditional', 'subordinate'], 'ant': ['independent'], 'topic': 'General Communication'},
    'detention': {'th': 'การกักกัน, การคุมขัง, การกักบริเวณ', 'syn': ['confinement', 'custody', 'imprisonment'], 'ant': ['release', 'freedom'], 'topic': 'Law, Society & Politics'},
    'disastrous': {'th': 'หายนะ, หายนะภัย, ก่อความเสียหายร้ายแรง', 'syn': ['catastrophic', 'calamitous', 'ruinous'], 'ant': ['beneficial', 'fortunate'], 'topic': 'Nature & Environment'},
    'disturbing': {'th': 'น่ารบกวนใจ, น่าเป็นห่วง, ชวนให้ไม่สบายใจ', 'syn': ['upsetting', 'worrying', 'disquieting'], 'ant': ['comforting', 'soothing'], 'topic': 'Emotions & Personality'},
    'divorced': {'th': 'หย่าร้าง, แยกทางกัน', 'syn': ['separated', 'split', 'unmarried'], 'ant': ['married', 'wedded'], 'topic': 'Daily Life & Home'},
    'download': {'th': 'ดาวน์โหลด, ถ่ายโอนข้อมูลลงเครื่อง', 'syn': ['transfer', 'fetch', 'receive'], 'ant': ['upload'], 'topic': 'Science & Technology'},
    'dressed': {'th': 'แต่งตัว, สวมเสื้อผ้า', 'syn': ['clothed', 'attired', 'wearing'], 'ant': ['undressed', 'naked'], 'topic': 'Daily Life & Home'},
    'driving': {'th': 'การขับขี่รถยนต์', 'syn': ['motoring', 'steering', 'operating'], 'ant': [], 'topic': 'Travel & Transportation'},
    'dvd': {'th': 'แผ่นดีวีดี (บันทึกภาพและเสียง)', 'syn': ['optical disc', 'disc'], 'ant': [], 'topic': 'Arts, Media & Entertainment'},
    'ecological': {'th': 'ทางนิเวศวิทยา, เชิงระบบนิเวศ', 'syn': ['environmental', 'biological', 'green'], 'ant': [], 'topic': 'Nature & Environment'},
    'effectiveness': {'th': 'ประสิทธิผล, ความมีประสิทธิภาพในการทำงาน', 'syn': ['efficiency', 'success', 'efficacy'], 'ant': ['ineffectiveness'], 'topic': 'Business & Work'},
    'email': {'th': 'อีเมล, จดหมายอิเล็กทรอนิกส์', 'syn': ['electronic mail', 'message'], 'ant': [], 'topic': 'Science & Technology'},
    'embarrassing': {'th': 'น่าอับอาย, น่าเก้อเขิน', 'syn': ['awkward', 'humiliating', 'shameful'], 'ant': ['proud'], 'topic': 'Emotions & Personality'},
    'emergence': {'th': 'การปรากฏขึ้น, การกำเนิดขึ้นมา', 'syn': ['appearance', 'rise', 'arrival'], 'ant': ['disappearance'], 'topic': 'General Communication'},
    'encouraging': {'th': 'ที่ให้กำลังใจ, มีแนวโน้มที่ดี', 'syn': ['promising', 'heartening', 'reassuring'], 'ant': ['discouraging'], 'topic': 'Emotions & Personality'},
    'endorsement': {'th': 'การรับรอง, การสนับสนุนอย่างเป็นทางการ', 'syn': ['approval', 'backing', 'advocacy'], 'ant': ['disapproval'], 'topic': 'Business & Work'},
    'enrol': {'th': 'ลงทะเบียน, สมัครเข้าเรียน/สมาชิก', 'syn': ['register', 'sign up', 'enlist'], 'ant': ['withdraw'], 'topic': 'Education & Academic'},
    'enthusiast': {'th': 'ผู้มีความคลั่งไคล้, แฟนตัวยง', 'syn': ['fan', 'devotee', 'supporter'], 'ant': ['critic'], 'topic': 'Emotions & Personality'},
    'environmental': {'th': 'เกี่ยวกับสิ่งแวดล้อม', 'syn': ['ecological', 'green'], 'ant': [], 'topic': 'Nature & Environment'},
    'euro': {'th': 'สกุลเงินยูโร', 'syn': ['currency', 'money'], 'ant': [], 'topic': 'Business & Work'},
    'evaluation': {'th': 'การประเมินผล, การตีราคาคุณค่า', 'syn': ['assessment', 'appraisal', 'review'], 'ant': [], 'topic': 'Business & Work'},
    'evolutionary': {'th': 'ทางวิวัฒนาการ, ค่อยๆ พัฒนา', 'syn': ['developmental', 'gradual'], 'ant': ['revolutionary'], 'topic': 'Science & Technology'},
    'exclusive': {'th': 'พิเศษเฉพาะ, แต่เพียงผู้เดียว, เอกสิทธิ์', 'syn': ['sole', 'unique', 'private'], 'ant': ['inclusive', 'public'], 'topic': 'Business & Work'},
    'exclusively': {'th': 'โดยเฉพาะ, แต่เพียงอย่างเดียว', 'syn': ['only', 'solely', 'purely'], 'ant': ['inclusively'], 'topic': 'General Communication'},
    'exposure': {'th': 'การเปิดเผย, การสัมผัสรับสิ่งต่างๆ', 'syn': ['disclosure', 'contact', 'vulnerability'], 'ant': ['protection'], 'topic': 'General Communication'},
    'extremist': {'th': 'ผู้มีความคิดสุดโต่ง, ผู้คลั่งอุดมการณ์', 'syn': ['radical', 'fanatic', 'zealot'], 'ant': ['moderate'], 'topic': 'Law, Society & Politics'},
    'failed': {'th': 'ล้มเหลว, ไม่ประสบความสำเร็จ', 'syn': ['unsuccessful', 'broken'], 'ant': ['successful'], 'topic': 'Business & Work'},
    'favourable': {'th': 'เป็นที่น่าพอใจ, เอื้ออำนวย, ส่งผลดี', 'syn': ['advantageous', 'positive', 'beneficial'], 'ant': ['unfavourable'], 'topic': 'General Communication'},
    'favourite': {'th': 'ที่ชื่นชอบ, ของโปรด, คนโปรด', 'syn': ['preferred', 'beloved', 'chosen'], 'ant': ['disliked'], 'topic': 'Emotions & Personality'},
    'feat': {'th': 'ความสำเร็จอันยิ่งใหญ่, ความสามารถพิเศษ', 'syn': ['achievement', 'accomplishment', 'triumph'], 'ant': ['failure'], 'topic': 'General Communication'},
    'fighting': {'th': 'การต่อสู้, การชกต่อย, การรบ', 'syn': ['combat', 'struggle', 'battle'], 'ant': ['peace'], 'topic': 'Law, Society & Politics'},
    'film-maker': {'th': 'ผู้สร้างภาพยนตร์, ผู้กำกับหนัง', 'syn': ['director', 'producer'], 'ant': [], 'topic': 'Arts, Media & Entertainment'},
    'firefighter': {'th': 'นักดับเพลิง', 'syn': ['fireman', 'rescuer'], 'ant': [], 'topic': 'General & Daily Life'},
    'flawed': {'th': 'มีข้อบกพร่อง, มีตำหนิ', 'syn': ['imperfect', 'defective', 'faulty'], 'ant': ['flawless', 'perfect'], 'topic': 'General Communication'},
    'footage': {'th': 'ฟุตเทจ, ภาพบันทึกวิดีโอเหตุการณ์', 'syn': ['recording', 'video clip'], 'ant': [], 'topic': 'Arts, Media & Entertainment'},
    'frightening': {'th': 'น่าสะพรึงกลัว, น่าตกใจ', 'syn': ['scary', 'terrifying', 'fearsome'], 'ant': ['calming'], 'topic': 'Emotions & Personality'},
    'frustrating': {'th': 'น่าหงุดหงิดใจ, ชวนให้ท้อแท้', 'syn': ['annoying', 'infuriating', 'irritating'], 'ant': ['satisfying'], 'topic': 'Emotions & Personality'},
    'fulfil': {'th': 'ทำให้สำเร็จ, เติมเต็ม, ปฏิบัติตามสัญญา', 'syn': ['accomplish', 'achieve', 'satisfy'], 'ant': ['fail'], 'topic': 'General Communication'},
    'funding': {'th': 'เงินทุน, การจัดหาทุน', 'syn': ['financing', 'financial support', 'capital'], 'ant': [], 'topic': 'Business & Work'},
    'fundraising': {'th': 'การระดมทุน, การหาเงินบริจาค', 'syn': ['charity drive', 'collection'], 'ant': [], 'topic': 'Business & Work'},
    'gaming': {'th': 'การเล่นเกมคอมพิวเตอร์', 'syn': ['video gaming', 'playing'], 'ant': [], 'topic': 'Arts, Media & Entertainment'},
    'genetic': {'th': 'ทางพันธุศาสตร์, เกี่ยวกับยีน', 'syn': ['hereditary', 'inherited', 'biological'], 'ant': ['acquired'], 'topic': 'Science & Technology'},
    'genuinely': {'th': 'อย่างแท้จริง, จากใจจริง', 'syn': ['truly', 'authentically', 'sincerely'], 'ant': ['falsely'], 'topic': 'Emotions & Personality'},
    'governance': {'th': 'การกำกับดูแล, ธรรมาภิบาล', 'syn': ['administration', 'control', 'management'], 'ant': ['anarchy'], 'topic': 'Law, Society & Politics'},
    'handling': {'th': 'การจัดการ, การควบคุม, การจับถือ', 'syn': ['management', 'treatment', 'manipulation'], 'ant': [], 'topic': 'Business & Work'},
    'harassment': {'th': 'การคุกคาม, การรังควาน', 'syn': ['persecution', 'intimidation'], 'ant': ['respect'], 'topic': 'Law, Society & Politics'},
    'healthcare': {'th': 'การดูแลสุขภาพ, บริการสาธารณสุข', 'syn': ['medical care', 'health service'], 'ant': [], 'topic': 'Health & Medicine'},
    'heating': {'th': 'การทำความร้อน, เครื่องทำความร้อน', 'syn': ['warming', 'heater'], 'ant': ['cooling'], 'topic': 'Daily Life & Home'},
    'high-profile': {'th': 'เป็นที่จับตามอง, โดดเด่นในสายตาสาธารณะ', 'syn': ['prominent', 'famous', 'celebrated'], 'ant': ['obscure'], 'topic': 'Arts, Media & Entertainment'},
    'implementation': {'th': 'การนำไปปฏิบัติ, การดำเนินการตามแผน', 'syn': ['execution', 'application', 'enactment'], 'ant': ['abandonment'], 'topic': 'Business & Work'},
    'impressed': {'th': 'ประทับใจ, ซาบซึ้ง', 'syn': ['touched', 'admiring', 'awed'], 'ant': ['unimpressed'], 'topic': 'Emotions & Personality'},
    'included': {'th': 'รวมอยู่ด้วย, นับรวม', 'syn': ['contained', 'comprised'], 'ant': ['excluded'], 'topic': 'General Communication'},
    'incredibly': {'th': 'อย่างไม่น่าเชื่อ, อย่างยิ่ง', 'syn': ['unbelievably', 'extremely', 'remarkably'], 'ant': ['ordinarily'], 'topic': 'General Communication'},
    'info': {'th': 'ข้อมูล, สารสนเทศ', 'syn': ['information', 'data', 'details'], 'ant': [], 'topic': 'Science & Technology'},
    'innovative': {'th': 'มีนวัตกรรม, สร้างสรรค์สิ่งใหม่', 'syn': ['inventive', 'groundbreaking', 'original'], 'ant': ['traditional'], 'topic': 'Science & Technology'},
    'institute': {'th': 'สถาบัน, องค์กรวิชาการ', 'syn': ['organization', 'academy', 'institution'], 'ant': [], 'topic': 'Education & Academic'},
    'intriguing': {'th': 'น่าสนใจใคร่รู้, น่าทึ่ง, ชวนค้นหา', 'syn': ['fascinating', 'engrossing', 'compelling'], 'ant': ['boring'], 'topic': 'Emotions & Personality'},
    'ironically': {'th': 'อย่างประชดประชัน, อย่างน่าขันในโชคชะตา', 'syn': ['paradoxically', 'sarcastically'], 'ant': [], 'topic': 'General Communication'},
    'jewellery': {'th': 'อัญมณี, เครื่องประดับมีค่า', 'syn': ['jewelry', 'gems', 'ornaments'], 'ant': [], 'topic': 'Daily Life & Home'},
    'kilometre': {'th': 'กิโลเมตร (หน่วยวัดระยะทาง)', 'syn': ['kilometer', 'km'], 'ant': [], 'topic': 'General Communication'},
    'legendary': {'th': 'ในตำนาน, เป็นที่เลื่องลือ', 'syn': ['mythical', 'famous', 'iconic'], 'ant': ['obscure'], 'topic': 'Arts, Media & Entertainment'},
    'line-up': {'th': 'รายชื่อผู้เข้าร่วม, รายชื่อตัวจริง, แถวเรียง', 'syn': ['roster', 'list', 'formation'], 'ant': [], 'topic': 'Arts, Media & Entertainment'},
    'located': {'th': 'ตั้งอยู่, มีที่ตั้ง ณ', 'syn': ['situated', 'placed', 'positioned'], 'ant': [], 'topic': 'Travel & Transportation'},
    'mainstream': {'th': 'กระแสหลัก, ความนิยมทั่วไป', 'syn': ['conventional', 'popular', 'dominant'], 'ant': ['niche'], 'topic': 'Society & Culture'},
    'matching': {'th': 'ที่เข้าคู่กัน, ที่ตรงกัน', 'syn': ['corresponding', 'harmonious'], 'ant': ['clashing'], 'topic': 'Daily Life & Home'},
    'neighbourhood': {'th': 'ย่าน, ละแวกบ้าน, แถวใกล้เคียง', 'syn': ['neighborhood', 'district', 'vicinity'], 'ant': [], 'topic': 'Daily Life & Home'},
    'non-profit': {'th': 'ไม่แสวงหาผลกำไร (องค์กรการกุศล)', 'syn': ['charitable', 'voluntary'], 'ant': ['commercial'], 'topic': 'Business & Work'},
    'permanently': {'th': 'อย่างถาวร, ตลอดไป', 'syn': ['forever', 'lasting', 'perpetually'], 'ant': ['temporarily'], 'topic': 'General Communication'},
    'placement': {'th': 'การจัดวาง, การบรรจุตำแหน่งงาน/ที่เรียน', 'syn': ['positioning', 'arrangement', 'assignment'], 'ant': [], 'topic': 'Business & Work'},
    'planning': {'th': 'การวางแผน, การกำหนดขั้นตอน', 'syn': ['preparation', 'organization', 'design'], 'ant': [], 'topic': 'Business & Work'},
    'post-war': {'th': 'ยุคหลังสงคราม', 'syn': ['after the war'], 'ant': ['pre-war'], 'topic': 'Law, Society & Politics'},
    'potentially': {'th': 'ซึ่งอาจเกิดขึ้นได้, มีแนวโน้มว่า', 'syn': ['possibly', 'probably', 'likely'], 'ant': ['impossibly'], 'topic': 'General Communication'},
    'precisely': {'th': 'อย่างแม่นยำ, ตรงเผง, ถูกต้องแน่นอน', 'syn': ['accurately', 'exactly', 'specifically'], 'ant': ['approximately'], 'topic': 'General Communication'},
    'predictable': {'th': 'คาดเดาได้ง่าย, เป็นไปตามที่คิด', 'syn': ['foreseeable', 'expected', 'routine'], 'ant': ['unpredictable'], 'topic': 'General Communication'},
    'predominantly': {'th': 'เป็นส่วนใหญ่, เด่นชัดที่สุด', 'syn': ['mainly', 'mostly', 'primarily'], 'ant': ['rarely'], 'topic': 'General Communication'},
    'printing': {'th': 'การพิมพ์, สิ่งพิมพ์', 'syn': ['publishing', 'press', 'typography'], 'ant': [], 'topic': 'Arts, Media & Entertainment'},
    'privatization': {'th': 'การแปรรูปเป็นของเอกชน', 'syn': ['denationalization'], 'ant': ['nationalization'], 'topic': 'Business & Work'},
    'recognition': {'th': 'การยอมรับ, การระลึกได้, เกียรติคุณ', 'syn': ['acknowledgment', 'appreciation', 'identification'], 'ant': ['denial'], 'topic': 'Business & Work'},
    'scared': {'th': 'หวาดกลัว, ตกใจกลัว', 'syn': ['frightened', 'afraid', 'terrified'], 'ant': ['brave'], 'topic': 'Emotions & Personality'},
    'set-up': {'th': 'การจัดตั้ง, โครงสร้าง, การตั้งค่า', 'syn': ['arrangement', 'configuration', 'structure'], 'ant': [], 'topic': 'Business & Work'},
    'shaped': {'th': 'มีรูปร่าง, ได้รับการหล่อหลอม', 'syn': ['formed', 'molded', 'fashioned'], 'ant': [], 'topic': 'General Communication'},
    'shocked': {'th': 'ตกใจ, ตกตะลึง, ช็อก', 'syn': ['stunned', 'appalled', 'astonished'], 'ant': ['calm'], 'topic': 'Emotions & Personality'},
    'shooting': {'th': 'การถ่ายทำ (หนัง/ภาพ), การยิงปืน', 'syn': ['filming', 'gunfire', 'firing'], 'ant': [], 'topic': 'Arts, Media & Entertainment'},
    'shopping': {'th': 'การซื้อของ, การช็อปปิ้ง', 'syn': ['buying', 'purchasing'], 'ant': [], 'topic': 'Daily Life & Home'},
    'singing': {'th': 'การร้องเพลง', 'syn': ['vocalizing', 'chanting'], 'ant': [], 'topic': 'Arts, Media & Entertainment'},
    'situated': {'th': 'ตั้งอยู่, วางตำแหน่ง', 'syn': ['located', 'positioned', 'placed'], 'ant': [], 'topic': 'Travel & Transportation'},
    'smartphone': {'th': 'สมาร์ตโฟน, โทรศัพท์มือถืออัจฉริยะ', 'syn': ['mobile phone', 'cellphone'], 'ant': [], 'topic': 'Science & Technology'},
    'smoking': {'th': 'การสูบบุหรี่', 'syn': ['tobacco use'], 'ant': [], 'topic': 'Health & Medicine'},
    'specialized': {'th': 'เฉพาะทาง, มีความเชี่ยวชาญพิเศษ', 'syn': ['expert', 'customized', 'technical'], 'ant': ['generalized'], 'topic': 'Business & Work'},
    'specifically': {'th': 'โดยเฉพาะเจาะจง, อย่างชัดเจน', 'syn': ['expressly', 'particularly', 'uniquely'], 'ant': ['generally'], 'topic': 'General Communication'},
    'spending': {'th': 'การใช้จ่าย, งบรายจ่าย', 'syn': ['expenditure', 'disbursement', 'outlay'], 'ant': ['saving'], 'topic': 'Business & Work'},
    'sponsorship': {'th': 'การสนับสนุนทางการเงิน, สปอนเซอร์', 'syn': ['patronage', 'backing', 'funding'], 'ant': [], 'topic': 'Business & Work'},
    'steadily': {'th': 'อย่างมั่นคง, อย่างต่อเนื่องทีละน้อย', 'syn': ['consistently', 'gradually', 'firmly'], 'ant': ['erratically'], 'topic': 'General Communication'},
    'submission': {'th': 'การส่งมอบผลงาน, การยอมจำนน', 'syn': ['presentation', 'surrender', 'compliance'], 'ant': ['resistance'], 'topic': 'Business & Work'},
    'substantially': {'th': 'อย่างมาก, อย่างมีนัยสำคัญ', 'syn': ['considerably', 'significantly', 'largely'], 'ant': ['slightly'], 'topic': 'General Communication'},
    'supposedly': {'th': 'ตามที่คาดเดา, น่าจะเป็นเช่นนั้น', 'syn': ['allegedly', 'reportedly', 'presumably'], 'ant': ['definitely'], 'topic': 'General Communication'},
    'sustainable': {'th': 'ยั่งยืน, เป็นมิตรต่อสิ่งแวดล้อมและยาวนาน', 'syn': ['renewable', 'viable', 'enduring'], 'ant': ['unsustainable'], 'topic': 'Nature & Environment'},
    'testing': {'th': 'การทดสอบ, การทดลอง', 'syn': ['examination', 'trial', 'evaluation'], 'ant': [], 'topic': 'Education & Academic'},
    'thankfully': {'th': 'โชคดีที่, อย่างน่าขอบคุณ', 'syn': ['fortunately', 'luckily', 'gratefully'], 'ant': ['unfortunately'], 'topic': 'Emotions & Personality'},
    'thought-provoking': {'th': 'ชวนให้คิด, จุดประกายความคิด', 'syn': ['stimulating', 'challenging', 'inspiring'], 'ant': ['uninspiring'], 'topic': 'Education & Academic'},
    'thrilled': {'th': 'ตื่นเต้นยินดี, ปลื้มปิติเป็นอย่างยิ่ง', 'syn': ['excited', 'delighted', 'overjoyed'], 'ant': ['bored'], 'topic': 'Emotions & Personality'},
    'towards': {'th': 'ไปทาง, มุ่งหน้าสู่, เกี่ยวกับ', 'syn': ['in the direction of', 'to'], 'ant': ['away from'], 'topic': 'General Communication'},
    'trading': {'th': 'การค้าขาย, การแลกเปลี่ยนซื้อขาย', 'syn': ['commerce', 'merchandising', 'dealing'], 'ant': [], 'topic': 'Business & Work'},
    'transmission': {'th': 'การส่งผ่าน, การแพร่กระจายเชื้อ/สัญญาณ', 'syn': ['broadcast', 'transfer', 'conveyance'], 'ant': ['reception'], 'topic': 'Science & Technology'},
    'troubled': {'th': 'ที่มีปัญหา, กระสับกระส่าย, วุ่นวายใจ', 'syn': ['distressed', 'worried', 'turbulent'], 'ant': ['peaceful'], 'topic': 'Emotions & Personality'},
    'tsunami': {'th': 'คลื่นยักษ์สึนามิ', 'syn': ['tidal wave', 'seismic sea wave'], 'ant': [], 'topic': 'Nature & Environment'},
    'yell': {'th': 'ตะโกน, ร้องเสียงดัง', 'syn': ['shout', 'scream', 'cry out'], 'ant': ['whisper'], 'topic': 'General Communication'},
    'you': {'th': 'คุณ, ท่าน, เธอ', 'syn': ['thou', 'one'], 'ant': ['me', 'I'], 'topic': 'General Communication'}
}

# 3. Topic classification keywords
TOPIC_KEYWORDS = {
    'Daily Life & Home': [
        'home', 'house', 'room', 'door', 'window', 'bed', 'chair', 'table', 'kitchen', 'sleep', 'wake',
        'morning', 'night', 'day', 'clock', 'time', 'clean', 'wash', 'wear', 'clothes', 'shoe', 'hat',
        'family', 'mother', 'father', 'sister', 'brother', 'child', 'baby', 'friend', 'neighbor', 'pet',
        'dog', 'cat', 'walk', 'sit', 'stand', 'open', 'close', 'live', 'living', 'routine', 'shower',
        'bath', 'soap', 'towel', 'mirror', 'brush', 'comb', 'dress', 'shirt', 'pants', 'coat', 'carpet',
        'furniture', 'shelf', 'garden', 'roof', 'floor', 'wall', 'key', 'lock', 'laundry', 'household', 'shopping'
    ],
    'Food & Dining': [
        'food', 'eat', 'drink', 'water', 'tea', 'coffee', 'bread', 'meat', 'fish', 'rice', 'fruit',
        'apple', 'banana', 'vegetable', 'potato', 'soup', 'salad', 'sugar', 'salt', 'milk', 'egg',
        'cake', 'cheese', 'cook', 'bake', 'fry', 'boil', 'taste', 'delicious', 'sweet', 'sour', 'bitter',
        'restaurant', 'cafe', 'menu', 'dinner', 'lunch', 'breakfast', 'meal', 'chef', 'recipe',
        'fork', 'spoon', 'knife', 'plate', 'cup', 'glass', 'bottle', 'snack', 'dessert', 'beer', 'wine',
        'hungry', 'thirsty', 'sauce', 'flavor', 'flavour', 'butter', 'chocolate', 'dining', 'diet'
    ],
    'Business & Work': [
        'business', 'company', 'office', 'job', 'work', 'worker', 'career', 'profession', 'manager',
        'boss', 'employee', 'employer', 'salary', 'wage', 'contract', 'meeting', 'client', 'customer',
        'market', 'marketing', 'sale', 'sales', 'trade', 'industry', 'factory', 'enterprise', 'corporate',
        'finance', 'financial', 'profit', 'loss', 'budget', 'investment', 'investor', 'economy', 'economic',
        'bank', 'tax', 'revenue', 'expense', 'debt', 'loan', 'cost', 'price', 'product', 'production',
        'commercial', 'commerce', 'negotiate', 'deal', 'hire', 'fire', 'retire', 'colleague', 'strategy',
        'fund', 'funding', 'fundraising', 'dealer', 'sponsorship'
    ],
    'Science & Technology': [
        'science', 'scientific', 'scientist', 'technology', 'tech', 'technical', 'computer', 'software',
        'hardware', 'internet', 'web', 'website', 'online', 'data', 'digital', 'network', 'system',
        'program', 'code', 'device', 'phone', 'mobile', 'screen', 'keyboard', 'mouse', 'robot', 'ai',
        'artificial', 'machine', 'engine', 'electric', 'electronic', 'energy', 'power', 'battery', 'solar',
        'physics', 'chemistry', 'biology', 'laboratory', 'experiment', 'research', 'discover', 'invention',
        'space', 'planet', 'star', 'satellite', 'telescope', 'atom', 'molecule', 'cell', 'genetic', 'dna',
        'download', 'email', 'blog', 'broadband', 'activation'
    ],
    'Education & Academic': [
        'school', 'university', 'college', 'student', 'teacher', 'professor', 'class', 'classroom',
        'course', 'study', 'learn', 'education', 'academic', 'degree', 'diploma', 'exam', 'test', 'quiz',
        'grade', 'mark', 'homework', 'lesson', 'lecture', 'read', 'write', 'book', 'textbook', 'library',
        'knowledge', 'theory', 'concept', 'analyze', 'analysis', 'essay', 'thesis', 'scholar', 'campus',
        'tuition', 'certificate', 'graduate', 'undergraduate', 'curriculum', 'faculty', 'subject', 'math', 'testing'
    ],
    'Travel & Transportation': [
        'travel', 'trip', 'journey', 'tour', 'tourist', 'tourism', 'visit', 'visitor', 'vacation', 'holiday',
        'hotel', 'resort', 'passport', 'visa', 'airport', 'plane', 'airplane', 'flight', 'fly', 'ticket',
        'luggage', 'baggage', 'car', 'bus', 'train', 'station', 'subway', 'metro', 'taxi', 'drive', 'driver',
        'road', 'street', 'highway', 'traffic', 'ship', 'boat', 'port', 'cruise', 'bicycle', 'bike', 'ride',
        'destination', 'explore', 'map', 'direction', 'guide', 'aboard', 'abroad', 'foreign', 'border', 'cabin', 'camping'
    ],
    'Health & Medicine': [
        'health', 'healthy', 'hospital', 'clinic', 'doctor', 'nurse', 'patient', 'medicine', 'medical',
        'drug', 'pill', 'disease', 'illness', 'sick', 'sickness', 'pain', 'ache', 'hurt', 'injury', 'wound',
        'cure', 'heal', 'treatment', 'therapy', 'surgery', 'surgeon', 'infection', 'virus', 'bacteria',
        'fever', 'cough', 'flu', 'cancer', 'blood', 'heart', 'bone', 'muscle', 'brain', 'body', 'diet',
        'fitness', 'exercise', 'gym', 'mental', 'stress', 'depression', 'symptom', 'diagnose', 'prescription',
        'healthcare', 'addiction', 'counselling'
    ],
    'Emotions & Personality': [
        'happy', 'happiness', 'sad', 'sadness', 'angry', 'anger', 'fear', 'afraid', 'scared', 'worry',
        'nervous', 'anxious', 'calm', 'relax', 'excited', 'bored', 'lonely', 'jealous', 'proud', 'shame',
        'embarrassed', 'surprised', 'confused', 'love', 'hate', 'like', 'dislike', 'hope', 'wish', 'mood',
        'feeling', 'emotion', 'personality', 'character', 'kind', 'friendly', 'polite', 'rude', 'brave',
        'honest', 'lazy', 'selfish', 'generous', 'confident', 'shy', 'funny', 'serious', 'patient', 'enthusiastic',
        'thrilled', 'disturbing', 'frustrating', 'frightening', 'cynical'
    ],
    'Nature & Environment': [
        'nature', 'natural', 'environment', 'environmental', 'earth', 'world', 'climate', 'weather',
        'sun', 'moon', 'sky', 'cloud', 'rain', 'snow', 'wind', 'storm', 'temperature', 'sea', 'ocean',
        'river', 'lake', 'mountain', 'hill', 'forest', 'tree', 'flower', 'plant', 'grass', 'leaf', 'wood',
        'animal', 'wild', 'wildlife', 'bird', 'fish', 'insect', 'desert', 'island', 'beach', 'soil',
        'pollution', 'recycle', 'green', 'planet', 'season', 'spring', 'summer', 'autumn', 'winter', 'tsunami', 'sustainable'
    ],
    'Law, Society & Politics': [
        'law', 'legal', 'illegal', 'court', 'judge', 'lawyer', 'police', 'crime', 'criminal', 'prison',
        'jail', 'guilty', 'innocent', 'punish', 'fine', 'rule', 'regulation', 'right', 'human rights',
        'government', 'president', 'minister', 'parliament', 'congress', 'policy', 'politics', 'political',
        'democracy', 'election', 'vote', 'voter', 'citizen', 'society', 'social', 'community', 'public',
        'state', 'nation', 'national', 'country', 'war', 'peace', 'military', 'army', 'soldier', 'security',
        'civilian', 'detention', 'governance', 'harassment', 'atrocity'
    ],
    'Arts, Media & Entertainment': [
        'art', 'artist', 'artistic', 'paint', 'painting', 'draw', 'drawing', 'music', 'musical', 'song',
        'sing', 'singer', 'instrument', 'guitar', 'piano', 'band', 'concert', 'movie', 'film', 'cinema',
        'theater', 'theatre', 'actor', 'actress', 'drama', 'dance', 'dancer', 'show', 'entertainment',
        'media', 'news', 'newspaper', 'magazine', 'journal', 'journalist', 'photo', 'photograph', 'camera',
        'radio', 'television', 'tv', 'broadcast', 'game', 'play', 'sport', 'match', 'stadium', 'champion',
        'artwork', 'dvd', 'footage', 'commentator', 'film-maker', 'gaming', 'singing', 'shooting'
    ]
}

def classify_topic(word, def_en, pos):
    text = f"{word} {def_en}".lower()
    best_topic = None
    best_score = 0
    
    for topic, keywords in TOPIC_KEYWORDS.items():
        score = 0
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', text):
                score += 2 if kw in word.lower() else 1
        if score > best_score:
            best_score = score
            best_topic = topic
            
    if not best_topic or best_score < 1:
        if pos in ['noun', 'verb']:
            best_topic = 'General Communication'
        elif pos in ['adjective', 'adverb']:
            best_topic = 'Descriptive & Expressions'
        else:
            best_topic = 'Grammar & Functional'
            
    return best_topic

# Function to get WordNet synonyms & antonyms
def get_wordnet_syns_ants(word):
    if len(word) <= 2:
        return [], []
    syns = set()
    ants = set()
    for s in wordnet.synsets(word):
        for l in s.lemmas():
            name = l.name().replace('_', ' ')
            if name.lower() != word.lower() and len(name) > 2 and not any(c.isdigit() for c in name):
                syns.add(name)
            if l.antonyms():
                for a in l.antonyms():
                    a_name = a.name().replace('_', ' ')
                    if a_name.lower() != word.lower() and len(a_name) > 2:
                        ants.add(a_name)
    return list(syns)[:5], list(ants)[:5]

# 4. Read Oxford 5000 raw
with open('oxford_5000_raw.json', 'r', encoding='utf-8') as f:
    oxford_raw = json.load(f)

print(f"Loaded Oxford items: {len(oxford_raw)}")

spelling_map = {
    'favourite': 'favorite',
    'favourable': 'favorable',
    'jewellery': 'jewelry',
    'enrol': 'enroll',
    'fulfil': 'fulfill',
    'kilometre': 'kilometer',
    'neighbourhood': 'neighborhood',
    'privatization': 'privatise',
    'specialized': 'specialise'
}

final_words = []
id_counter = 1

for k, item in oxford_raw.items():
    raw_word = item.get('word', '').strip()
    if not raw_word:
        continue
    w_lower = raw_word.lower()
    pos = item.get('type', '').strip().lower()
    cefr = item.get('cefr', '').strip().upper() or 'B1'
    phon_uk = item.get('phon_br', '').strip()
    phon_us = item.get('phon_n_am', '').strip()
    def_en = item.get('definition', '').strip()
    example = item.get('example', '').strip()
    
    # Matching Lexitron
    target_lookup = spelling_map.get(w_lower, w_lower)
    lex_entries = lex_dict.get(target_lookup, [])
    
    def_th = ""
    def_th_full = ""
    syns = []
    ants = []
    topic = ""
    
    if w_lower in UNMATCHED_DICT:
        un = UNMATCHED_DICT[w_lower]
        def_th = un['th']
        def_th_full = un['th']
        syns.extend(un['syn'])
        ants.extend(un['ant'])
        topic = un.get('topic', '')
    elif lex_entries:
        # Filter matching POS
        matched_pos_entries = []
        for e in lex_entries:
            ecat = e['cat'].upper()
            if 'verb' in pos and 'V' in ecat:
                matched_pos_entries.append(e)
            elif 'noun' in pos and 'N' in ecat:
                matched_pos_entries.append(e)
            elif 'adjective' in pos and 'ADJ' in ecat:
                matched_pos_entries.append(e)
            elif 'adverb' in pos and 'ADV' in ecat:
                matched_pos_entries.append(e)
            elif 'preposition' in pos and 'PREP' in ecat:
                matched_pos_entries.append(e)
            elif 'conjunction' in pos and 'CONJ' in ecat:
                matched_pos_entries.append(e)
            elif 'pronoun' in pos and 'PRON' in ecat:
                matched_pos_entries.append(e)
        
        target_entries = matched_pos_entries if matched_pos_entries else lex_entries
        
        # Collect unique meanings
        meanings = []
        seen = set()
        for e in target_entries:
            for cand in [e['tentry'], e['ethai']]:
                if not cand: continue
                clean = re.sub(r'\(.*?\)', '', cand).strip().rstrip(',')
                parts = [p.strip() for p in re.split(r'[,;/]', clean) if p.strip()]
                for p in parts:
                    if p and p not in seen and len(p) < 35:
                        seen.add(p)
                        meanings.append(p)
            syns.extend(e['syn'])
            ants.extend(e['ant'])
            
        if meanings:
            def_th = ", ".join(meanings[:3])
            def_th_full = ", ".join(meanings[:6])
        else:
            def_th = target_entries[0]['ethai'] or target_entries[0]['tentry']
            def_th_full = def_th
            
    # WordNet supplement
    wn_s, wn_a = get_wordnet_syns_ants(w_lower)
    all_syns = []
    for s in syns + wn_s:
        s_clean = s.strip().rstrip(';')
        if s_clean and s_clean.lower() != w_lower and s_clean not in all_syns and len(s_clean) > 2:
            all_syns.append(s_clean)
            
    all_ants = []
    for a in ants + wn_a:
        a_clean = a.strip().rstrip(';')
        if a_clean and a_clean.lower() != w_lower and a_clean not in all_ants and len(a_clean) > 2:
            all_ants.append(a_clean)
            
    all_syns = all_syns[:5]
    all_ants = all_ants[:5]
    
    if not topic:
        topic = classify_topic(raw_word, def_en, pos)
        
    if not def_th:
        def_th = def_en
        def_th_full = def_en
        
    final_words.append({
        'id': id_counter,
        'word': raw_word,
        'pos': pos,
        'cefr': cefr,
        'topic': topic,
        'phon_uk': phon_uk,
        'phon_us': phon_us,
        'def_en': def_en,
        'def_th': def_th,
        'def_th_full': def_th_full,
        'example': example,
        'synonyms': all_syns,
        'antonyms': all_ants
    })
    id_counter += 1

print(f"Generated total words: {len(final_words)}")

os.makedirs('data', exist_ok=True)
output_path = os.path.join('data', 'oxford5000.json')

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(final_words, f, ensure_ascii=False, indent=None, separators=(',', ':'))

file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
print(f"Saved to {output_path} ({file_size_mb:.2f} MB)")
