/**
 * Rarities for the Magic Items 2025 rows that Notion left without one, plus Axe of the
 * Dwarvish Lords, which the 2024 rules made an artifact (Notion had it as legendary).
 * Keyed by Notion page id; cleanup.ts applies them on import. The duplicates cleanup.ts
 * removes aren't listed, and its renames are.
 *
 * Looked up on D&D Beyond on 2026-11-02, by each row's Item URL. The item pages for the
 * 2024 DMG need the book, so rarities come from D&D Beyond's magic item list, which shows
 * every item's rarity:
 *   listed: the list's rarity for this exact item
 *   parent: a variant the list files under its parent (named in the note), rarity from
 *           the parent's table
 *   rule:   not on D&D Beyond; rarity from the DMG's rule for its kind
 * Where the book gives the rarity as "varies", `rarity` is the lowest tier and `varies`
 * says what it depends on; cleanup.ts writes that into the Rarity Varies column.
 *
 * rare 18, uncommon 18, very_rare 15, artifact 9, common 6, varies (as uncommon) 61, legendary 5
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary' | 'artifact';

export interface RarityLookup {
  name: string;
  rarity: Rarity;
  how: 'listed' | 'parent' | 'rule';
  note?: string;
  /** What the rarity depends on, when the book gives it as "varies". */
  varies?: string;
  /** The D&D Beyond magic item it was looked up by. */
  ddb: string;
}

export const MAGIC_ITEM_RARITIES: Record<string, RarityLookup> = {
  '260151b2-7259-81e3-9850-f50502292dd4': { name: 'Amulet of Health', rarity: 'rare', how: 'listed', ddb: '4568-amulet-of-health' },
  '260151b2-7259-81cb-aeee-c80ea7f1af7e': { name: 'Amulet of Proof against Detection and Location', rarity: 'uncommon', how: 'listed', ddb: '4569-amulet-of-proof-against-detection-and-location' },
  '260151b2-7259-81dc-a1eb-e8f2d1e5c5bc': { name: 'Animated Shield', rarity: 'very_rare', how: 'listed', ddb: '4571-animated-shield' },
  '260151b2-7259-812a-8832-cc72dd047b41': { name: 'Axe of the Dwarvish Lords', rarity: 'artifact', how: 'listed', note: 'Notion had it as legendary', ddb: '9228353-axe-of-the-dwarvish-lords' },
  '260151b2-7259-8112-a877-e08b03c0a023': { name: 'Book of Exalted Deeds', rarity: 'artifact', how: 'listed', ddb: '9228363-book-of-exalted-deeds' },
  '260151b2-7259-81bd-870a-c98af936fbe2': { name: 'Book of Vile Darkness', rarity: 'artifact', how: 'listed', ddb: '9228364-book-of-vile-darkness' },
  '260151b2-7259-8168-b577-f4c1f3465f5f': { name: 'Boots of Speed', rarity: 'rare', how: 'listed', ddb: '4589-boots-of-speed' },
  '260151b2-7259-8156-9331-f1bb3777b096': { name: 'Boots of the Winterlands', rarity: 'uncommon', how: 'listed', ddb: '4591-boots-of-the-winterlands' },
  '260151b2-7259-8193-bfaa-fea484b2c13f': { name: 'Bracers of Archery', rarity: 'uncommon', how: 'listed', ddb: '4593-bracers-of-archery' },
  '260151b2-7259-8183-81b2-c9ec3eaa288d': { name: 'Bracers of Defense', rarity: 'rare', how: 'listed', ddb: '4594-bracers-of-defense' },
  '260151b2-7259-81f9-adda-d0080ecdd5f5': { name: 'Chest of Preserving', rarity: 'common', how: 'listed', ddb: '372030-chest-of-preserving' },
  '260151b2-7259-81b0-aa7a-d80fd924b085': { name: 'Cloak of Arachnida', rarity: 'very_rare', how: 'listed', ddb: '4604-cloak-of-arachnida' },
  '260151b2-7259-819e-b280-c9080415041d': { name: 'Cloak of Billowing', rarity: 'common', how: 'listed', ddb: '27040-cloak-of-billowing' },
  '260151b2-7259-811d-a15a-f4b12e75f331': { name: 'Cloak of Protection', rarity: 'uncommon', how: 'listed', ddb: '4607-cloak-of-protection' },
  '260151b2-7259-81c8-bfe1-f9de55d42eaf': { name: 'Cloak of the Bat', rarity: 'rare', how: 'listed', ddb: '4608-cloak-of-the-bat' },
  '260151b2-7259-81c1-91ec-f336d36b56fc': { name: 'Clockwork Amulet', rarity: 'common', how: 'listed', ddb: '27042-clockwork-amulet' },
  '260151b2-7259-8102-be10-ed71ba32a71c': { name: 'Dancing Sword', rarity: 'very_rare', how: 'listed', ddb: '5383-dancing-sword' },
  '260151b2-7259-8173-bc7e-ce590af73fa0': { name: 'Demonomicon of Iggwilv', rarity: 'artifact', how: 'listed', ddb: '9228464-demonomicon-of-iggwilv' },
  '260151b2-7259-8152-9327-e4ec94040201': { name: 'Dread Helm', rarity: 'common', how: 'listed', ddb: '27045-dread-helm' },
  '260151b2-7259-81d1-a98a-f2e93d9372f9': { name: 'Dwarven Thrower', rarity: 'very_rare', how: 'listed', ddb: '4627-dwarven-thrower' },
  '260151b2-7259-81b3-a81f-e916a389f1c2': { name: 'Efficient Quiver', rarity: 'uncommon', how: 'listed', ddb: '4628-efficient-quiver' },
  '260151b2-7259-817d-a49c-d0993ec86a97': { name: 'Enspelled Antimatter Rifle', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228540-enspelled-antimatter-rifle' },
  '260151b2-7259-8150-a720-cf2d8d7f0c8a': { name: 'Enspelled Automatic Rifle', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228542-enspelled-automatic-rifle' },
  '260151b2-7259-8113-a5e9-c703e8211403': { name: 'Enspelled Battleaxe', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228543-enspelled-battleaxe' },
  '260151b2-7259-8138-8756-e8a92cb2ff88': { name: 'Enspelled Blowgun', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228544-enspelled-blowgun' },
  '260151b2-7259-8119-9e24-d2496c257840': { name: 'Enspelled Breastplate', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228545-enspelled-breastplate' },
  '260151b2-7259-81eb-9e8d-dcc025954c34': { name: 'Enspelled Chain Mail', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228546-enspelled-chain-mail' },
  '260151b2-7259-819a-8bbf-ec4cd412beca': { name: 'Enspelled Chain Shirt', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228547-enspelled-chain-shirt' },
  '260151b2-7259-8154-a6a0-cdbc01cb0da0': { name: 'Enspelled Club', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228548-enspelled-club' },
  '260151b2-7259-8110-bb29-fef78f953272': { name: 'Enspelled Dagger', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228549-enspelled-dagger' },
  '260151b2-7259-8193-80fc-fba1e1200fc3': { name: 'Enspelled Dart', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228550-enspelled-dart' },
  '260151b2-7259-8197-8c7f-ee122ce76783': { name: 'Enspelled Flail', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228551-enspelled-flail' },
  '260151b2-7259-81d5-b24e-db23ba34c6b5': { name: 'Enspelled Glaive', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228552-enspelled-glaive' },
  '260151b2-7259-8168-b424-f8ea4e9c0e18': { name: 'Enspelled Greataxe', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228553-enspelled-greataxe' },
  '260151b2-7259-8121-a277-c2ab6143561e': { name: 'Enspelled Greatclub', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228554-enspelled-greatclub' },
  '260151b2-7259-81ab-93c6-e2b498c29c38': { name: 'Enspelled Greatsword', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228555-enspelled-greatsword' },
  '260151b2-7259-8186-97f8-e273b80d9e5d': { name: 'Enspelled Halberd', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228556-enspelled-halberd' },
  '260151b2-7259-8141-9437-d2d194c64726': { name: 'Enspelled Half Plate Armor', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228557-enspelled-half-plate-armor' },
  '260151b2-7259-81f3-a43d-e2d64c891081': { name: 'Enspelled Hand Crossbow', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228558-enspelled-hand-crossbow' },
  '260151b2-7259-818f-aac6-e832d6d869ec': { name: 'Enspelled Handaxe', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228559-enspelled-handaxe' },
  '260151b2-7259-813e-952e-e334d9d9b2aa': { name: 'Enspelled Heavy Crossbow', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228560-enspelled-heavy-crossbow' },
  '260151b2-7259-819b-bbf6-cdb9e1d5bea2': { name: 'Enspelled Hide Armor', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228561-enspelled-hide-armor' },
  '260151b2-7259-814e-a659-daa12bc04647': { name: 'Enspelled Hunting Rifle', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228562-enspelled-hunting-rifle' },
  '260151b2-7259-81b1-95a4-efa8bb82c3e9': { name: 'Enspelled Javelin', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228563-enspelled-javelin' },
  '260151b2-7259-81dc-abb6-c12ad825ecad': { name: 'Enspelled Lance', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228564-enspelled-lance' },
  '260151b2-7259-8171-8835-d28d8c7e8aa9': { name: 'Enspelled Laser Pistol', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228565-enspelled-laser-pistol' },
  '260151b2-7259-814a-9473-d061e11b013d': { name: 'Enspelled Laser Rifle', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228566-enspelled-laser-rifle' },
  '260151b2-7259-818f-a383-dfeb8d050cb1': { name: 'Enspelled Leather Armor', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228567-enspelled-leather-armor' },
  '260151b2-7259-8137-accb-e8e47823595d': { name: 'Enspelled Light Crossbow', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228568-enspelled-light-crossbow' },
  '260151b2-7259-81fb-98b8-e324bed1435e': { name: 'Enspelled Light Hammer', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228569-enspelled-light-hammer' },
  '260151b2-7259-81af-9dfa-d940d7382beb': { name: 'Enspelled Longbow', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228570-enspelled-longbow' },
  '260151b2-7259-812c-9b8d-f0838929b6bc': { name: 'Enspelled Longsword', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228571-enspelled-longsword' },
  '260151b2-7259-811d-b486-d43a3f3a6daf': { name: 'Enspelled Mace', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228572-enspelled-mace' },
  '260151b2-7259-81df-be33-efebec086481': { name: 'Enspelled Maul', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228573-enspelled-maul' },
  '260151b2-7259-81e6-8b81-e84062c2fb27': { name: 'Enspelled Morningstar', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228574-enspelled-morningstar' },
  '260151b2-7259-81df-9030-e661af838033': { name: 'Enspelled Musket', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228575-enspelled-musket' },
  '260151b2-7259-81f1-8384-e4a624e575da': { name: 'Enspelled Padded Armor', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228576-enspelled-padded-armor' },
  '260151b2-7259-814f-8777-de9e7c07f86a': { name: 'Enspelled Pike', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228577-enspelled-pike' },
  '260151b2-7259-81c6-bf3a-e31d00e46113': { name: 'Enspelled Pistol', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228578-enspelled-pistol' },
  '260151b2-7259-8181-8001-d1b287eaef31': { name: 'Enspelled Plate Armor', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228579-enspelled-plate-armor' },
  '260151b2-7259-814c-abc5-dad333e6313a': { name: 'Enspelled Quarterstaff', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228580-enspelled-quarterstaff' },
  '260151b2-7259-8121-9917-e08fe58e7af4': { name: 'Enspelled Rapier', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228581-enspelled-rapier' },
  '260151b2-7259-8183-8654-ce5ea024c5b3': { name: 'Enspelled Revolver', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228582-enspelled-revolver' },
  '260151b2-7259-81bb-b6c5-f6276165853f': { name: 'Enspelled Ring Mail', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228583-enspelled-ring-mail' },
  '260151b2-7259-81e3-888d-caa0eab834d2': { name: 'Enspelled Scale Mail', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228584-enspelled-scale-mail' },
  '260151b2-7259-8167-95a5-df0baf22bfa3': { name: 'Enspelled Scimitar', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228585-enspelled-scimitar' },
  '260151b2-7259-8154-b151-dd367ceb13d8': { name: 'Enspelled Semiautomatic Pistol', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228586-enspelled-semiautomatic-pistol' },
  '260151b2-7259-8133-99e1-cbb8836c9755': { name: 'Enspelled Shortbow', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228587-enspelled-shortbow' },
  '260151b2-7259-81de-b00a-c878fd99c905': { name: 'Enspelled Shortsword', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228588-enspelled-shortsword' },
  '260151b2-7259-8107-a235-f3d80e400f4e': { name: 'Enspelled Shotgun', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228589-enspelled-shotgun' },
  '260151b2-7259-8172-8a3f-c81928147b8f': { name: 'Enspelled Sickle', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228590-enspelled-sickle' },
  '260151b2-7259-8107-ba4e-ea43a20a9c63': { name: 'Enspelled Sling', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228591-enspelled-sling' },
  '260151b2-7259-81cc-a9ce-d22217bb0051': { name: 'Enspelled Spear', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228592-enspelled-spear' },
  '260151b2-7259-81e2-9bee-ee4d69a36001': { name: 'Enspelled Splint Armor', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228593-enspelled-splint-armor' },
  '260151b2-7259-81e1-bd53-ccdcc1c14938': { name: 'Enspelled Staff', rarity: 'uncommon', how: 'listed', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228594-enspelled-staff' },
  '260151b2-7259-8155-9ee7-f8c02af34f64': { name: 'Enspelled Studded Leather Armor', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228595-enspelled-studded-leather-armor' },
  '260151b2-7259-81d6-a3da-ddfe0e623984': { name: 'Enspelled Trident', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228596-enspelled-trident' },
  '260151b2-7259-81b6-a678-fd38112a2184': { name: 'Enspelled War Pick', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228597-enspelled-war-pick' },
  '260151b2-7259-8106-8da9-da776db46510': { name: 'Enspelled Warhammer', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228598-enspelled-warhammer' },
  '260151b2-7259-81f6-9e60-d67453cfb4f6': { name: 'Enspelled Whip', rarity: 'uncommon', how: 'parent', varies: 'by the spell stored in it: uncommon to legendary', ddb: '9228600-enspelled-whip' },
  '260151b2-7259-81cf-b644-db9c075f05ce': { name: 'Eye of Vecna', rarity: 'artifact', how: 'parent', note: 'Eye and Hand of Vecna', ddb: '9228609-eye-of-vecna' },
  '260151b2-7259-81cd-b1fc-ec524d5dc69a': { name: 'Flame Tongue', rarity: 'rare', how: 'listed', ddb: '5386-flame-tongue' },
  '260151b2-7259-81ca-8b3e-da5e1f6ac475': { name: 'Gauntlets of Ogre Power', rarity: 'uncommon', how: 'listed', ddb: '4641-gauntlets-of-ogre-power' },
  '260151b2-7259-818a-875e-d46ce1eab906': { name: 'Glamoured Studded Leather', rarity: 'rare', how: 'listed', ddb: '4645-glamoured-studded-leather' },
  '260151b2-7259-81d7-99cc-c9e00d287dea': { name: 'Goggles of Night', rarity: 'uncommon', how: 'listed', ddb: '4648-goggles-of-night' },
  '260151b2-7259-8187-b0ea-c7622004b1a2': { name: 'Hat of Disguise', rarity: 'uncommon', how: 'listed', ddb: '4651-hat-of-disguise' },
  '260151b2-7259-81dc-8565-f450844138a5': { name: 'Headband of Intellect', rarity: 'uncommon', how: 'listed', ddb: '4652-headband-of-intellect' },
  '260151b2-7259-8172-b651-eca8d4f715cb': { name: 'Helm of Comprehending Languages', rarity: 'uncommon', how: 'listed', ddb: '4654-helm-of-comprehending-languages' },
  '260151b2-7259-8178-841b-f0347689d7f1': { name: 'Helm of Teleportation', rarity: 'rare', how: 'listed', ddb: '4656-helm-of-teleportation' },
  '260151b2-7259-811a-8ea1-c6df2a68abff': { name: 'Heward’s Handy Haversack', rarity: 'rare', how: 'listed', ddb: '9228722-hewards-handy-haversack' },
  '260151b2-7259-8102-8344-f0fe017d4eae': { name: 'Holy Avenger Heavy Crossbow', rarity: 'legendary', how: 'parent', note: 'Holy Avenger', ddb: '9228743-holy-avenger-heavy-crossbow' },
  '260151b2-7259-810c-8235-e1728bb4651f': { name: 'Horn of Valhalla (Brass)', rarity: 'rare', how: 'parent', note: 'Horn of Valhalla, brass horn', ddb: '9228777-horn-of-valhalla-brass' },
  '260151b2-7259-81ca-882d-fbf721885d30': { name: 'Horn of Valhalla (Bronze)', rarity: 'very_rare', how: 'parent', note: 'Horn of Valhalla, bronze horn', ddb: '9228778-horn-of-valhalla-bronze' },
  '260151b2-7259-8143-abee-ec4f6380b78f': { name: 'Horn of Valhalla (Silver)', rarity: 'rare', how: 'parent', note: 'Horn of Valhalla, silver horn', ddb: '9228780-horn-of-valhalla-silver' },
  '260151b2-7259-81ff-afee-db336dfe1254': { name: 'Laser Rifle, +1', rarity: 'uncommon', how: 'rule', note: 'not on D&D Beyond; a +1 weapon is uncommon', ddb: '3414014-laser-rifle-1' },
  '260151b2-7259-8138-b157-c90f95a6631f': { name: 'Mace of Disruption', rarity: 'rare', how: 'listed', ddb: '4670-mace-of-disruption' },
  '260151b2-7259-814f-845a-f1c3d75d2dfd': { name: 'Manual of Gainful Exercise', rarity: 'very_rare', how: 'listed', ddb: '4675-manual-of-gainful-exercise' },
  '260151b2-7259-81fd-86f3-f5aad564e951': { name: 'Manual of Golems', rarity: 'very_rare', how: 'listed', ddb: '5416-manual-of-golems' },
  '260151b2-7259-8159-841c-dd52b07e39e4': { name: 'Manual of Quickness of Action', rarity: 'very_rare', how: 'listed', ddb: '4677-manual-of-quickness-of-action' },
  '260151b2-7259-81ff-af7e-f84f32fede8a': { name: 'Mariner\'s Plate Armor', rarity: 'uncommon', how: 'parent', note: 'Mariner\'s Armor', ddb: '9228845-mariners-plate-armor' },
  '260151b2-7259-8191-a5ad-d2d5ebe92d7f': { name: 'Mithral Armor', rarity: 'uncommon', how: 'listed', ddb: '5381-mithral-armor' },
  '260151b2-7259-8168-8c9f-c2efc879f7ac': { name: 'Moon-Touched Sword', rarity: 'common', how: 'listed', ddb: '36822-moon-touched-sword' },
  '260151b2-7259-8102-ab5d-c5766b8d60ef': { name: 'Necklace of Adaptation', rarity: 'uncommon', how: 'listed', ddb: '4682-necklace-of-adaptation' },
  '260151b2-7259-8187-bca1-d2f754d161d2': { name: 'Nine Lives Stealer', rarity: 'very_rare', how: 'listed', ddb: '5394-nine-lives-stealer' },
  '260151b2-7259-81ec-94a7-d50ac5618b07': { name: 'Portable Hole', rarity: 'rare', how: 'listed', ddb: '9228932-portable-hole' },
  '260151b2-7259-8128-89ef-dc006ee1b6fc': { name: 'Potion of Healing', rarity: 'common', how: 'parent', note: 'Potions of Healing', ddb: '8960641-potion-of-healing' },
  '260151b2-7259-8141-87ed-cff025576c3f': { name: 'Potion of Healing (Greater)', rarity: 'uncommon', how: 'parent', note: 'Potions of Healing', ddb: '5133-potion-of-healing-greater' },
  '260151b2-7259-81ee-8886-d5a64088b638': { name: 'Potion of Longevity', rarity: 'very_rare', how: 'listed', ddb: '5359-potion-of-longevity' },
  '260151b2-7259-813f-867b-e7180d0b7015': { name: 'Ring of Feather Falling', rarity: 'rare', how: 'listed', ddb: '4721-ring-of-feather-falling' },
  '260151b2-7259-81d7-b263-e81cddc40a0e': { name: 'Ring of Free Action', rarity: 'rare', how: 'listed', ddb: '4722-ring-of-free-action' },
  '260151b2-7259-81d2-b538-cd680664a1bb': { name: 'Ring of Protection', rarity: 'rare', how: 'listed', ddb: '4726-ring-of-protection' },
  '260151b2-7259-815e-a29a-c1278feca847': { name: 'Ring of Regeneration', rarity: 'very_rare', how: 'listed', ddb: '4727-ring-of-regeneration' },
  '260151b2-7259-8111-bb2a-fd26eebc17ae': { name: 'Ring of Spell Storing', rarity: 'rare', how: 'listed', ddb: '4730-ring-of-spell-storing' },
  '260151b2-7259-810f-807b-e823464fef69': { name: 'Ring of Three Wishes', rarity: 'legendary', how: 'listed', ddb: '4735-ring-of-three-wishes' },
  '260151b2-7259-8147-a2b8-f1098fae652a': { name: 'Robe of the Archmagi', rarity: 'legendary', how: 'listed', ddb: '4742-robe-of-the-archmagi' },
  '260151b2-7259-8137-af38-fe26f404d2a1': { name: 'Rod of Absorption', rarity: 'very_rare', how: 'listed', ddb: '4744-rod-of-absorption' },
  '260151b2-7259-8141-aa25-fa8a4c6520c2': { name: 'Scimitar of Speed', rarity: 'very_rare', how: 'listed', ddb: '4752-scimitar-of-speed' },
  '260151b2-7259-81b1-99bb-c5b399016f16': { name: 'Shield of Missile Attraction', rarity: 'rare', how: 'listed', ddb: '4754-shield-of-missile-attraction' },
  '260151b2-7259-81fc-9a96-ff1869c9be9d': { name: 'Slippers of Spider Climbing', rarity: 'uncommon', how: 'listed', ddb: '4755-slippers-of-spider-climbing' },
  '260151b2-7259-814f-b3ec-da40c5416805': { name: 'Sovereign Glue', rarity: 'legendary', how: 'listed', ddb: '9229074-sovereign-glue' },
  '260151b2-7259-81dd-9bdd-fc40fbaff2b3': { name: 'Sphere of Annihilation', rarity: 'legendary', how: 'listed', ddb: '9229086-sphere-of-annihilation' },
  '260151b2-7259-8113-b404-cda900f4e6fc': { name: 'Stone of Good Luck (Luckstone)', rarity: 'uncommon', how: 'listed', ddb: '4773-stone-of-good-luck-luckstone' },
  '260151b2-7259-81cb-975f-d433f1939a8e': { name: 'Sword of Kas', rarity: 'artifact', how: 'listed', ddb: '9229112-sword-of-kas' },
  '260151b2-7259-812f-826f-dfdb42092ac4': { name: 'Tome of Clear Thought', rarity: 'very_rare', how: 'listed', ddb: '4781-tome-of-clear-thought' },
  '260151b2-7259-81c6-ab9d-c5dffc98ca59': { name: 'Wand of Orcus', rarity: 'artifact', how: 'listed', ddb: '9229189-wand-of-orcus' },
  '260151b2-7259-8112-ba84-cff97e12abb1': { name: 'Wand of the War Mage', rarity: 'uncommon', how: 'listed', varies: 'by its bonus: +1 uncommon, +2 rare, +3 very rare', ddb: '34712-wand-of-the-war-mage' },
  '260151b2-7259-81d9-8d33-d7f0a0742729': { name: 'Wave', rarity: 'artifact', how: 'listed', ddb: '9229198-wave' },
  '260151b2-7259-816c-8aa1-c8b8cf97d857': { name: 'Whelm', rarity: 'artifact', how: 'listed', ddb: '9229201-whelm' },
  '260151b2-7259-8106-a2b9-f2e66ff266f0': { name: 'Wraps of Unarmed Prowess', rarity: 'uncommon', how: 'listed', varies: 'by its bonus: +1 uncommon, +2 rare, +3 very rare', ddb: '7526798-wraps-of-unarmed-prowess' },
  '260151b2-7259-8154-9333-f6821958fc80': { name: 'Yklwa, +1', rarity: 'uncommon', how: 'listed', ddb: '21941-yklwa-1' },
  '260151b2-7259-8108-b8fa-c6db3663a68c': { name: 'Yklwa, +2', rarity: 'rare', how: 'listed', ddb: '21942-yklwa-2' },
  '260151b2-7259-81dd-804c-ea4c13a164f2': { name: 'Yklwa, +3', rarity: 'very_rare', how: 'listed', ddb: '21943-yklwa-3' },
};
