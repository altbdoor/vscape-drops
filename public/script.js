(function (d, w, mustache) {
	var baseUrl,
		
		npcDefinitionsUrl,
		npcDropsUrl,
		itemsUrl,
		rareDropsUrl,
		
		npcDefinitions,
		npcDrops,
		items = [],
		rareDrops,
		
		searchItem = $('#search-item').val(''),
		searchItemResult = $('#search-item-result'),
		tmplItem = $('#tmpl-item').html(),
		
		searchMonster = $('#search-monster').val(''),
		searchMonsterResult = $('#search-monster-result'),
		tmplMonster = $('#tmpl-monster').html(),
		
		modalLoadingCount = $('#modal-loading-count');
	
	mustache.parse(tmplItem);
	mustache.parse(tmplMonster);
	
	$.ajax({
		beforeSend: function (request) {
			request.setRequestHeader('Accept', 'application/vnd.github.v3+json');
		},
		dataType: 'json',
		url: 'https://api.github.com/repos/Odel/vscape/commits/master',
		success: function (data) {
			var commit = data.sha,
				author = data.commit.author.name,
				date = data.commit.author.date;
			
			baseUrl = '//cdn.rawgit.com/Odel/vscape/' + commit + '/vscape%20Server/datajson';
			
			$('#commit-link').html('<b>' + commit.substr(0, 7) + '</b> by <b>' + author + '</b> on <b>' + date + '</b>')
				.attr('href', data.html_url);
			
			npcDefinitionsUrl = baseUrl + '/npcs/npcDefinitions.json';
			npcDropsUrl = baseUrl + '/npcs/npcDrops.json';
			itemsUrl = baseUrl + '/items.txt';
			rareDropsUrl = baseUrl + '/npcs/rareDrops.json';
			
			fetchNpcDefinitions();
			fetchNpcDrops();
			fetchItems();
			fetchRareDrops();
		}
	});
	
	
	function finishLoad () {
		var count = parseInt($(modalLoadingCount).text());
		
		count++;
		$(modalLoadingCount).text(count);
		
		if (count == 4) {
			setTimeout(function () {
				$(d.body).removeClass('modal-open');
				$('.modal, .modal-backdrop').remove();
				$(searchMonster).trigger('focus');
			}, 1000);
		}
	}
	
	function getItemDisplay (item) {
		return item.name + ' (ID: ' + item.id + ')';
	}
	
	function fetchNpcDefinitions () {
		$.getJSON(npcDefinitionsUrl, function (data) {
			finishLoad();
			
			var unusedKeys = ['respawn', 'combat', 'hitpoints', 'maxHit', 'size', 'attackSpeed', 'attackAnim', 'standAnim', 'walkAnim', 'defenceAnim', 'deathAnim', 'attackBonus', 'defenceMelee', 'defenceRange', 'defenceMage', 'attackSound', 'blockSound', 'damageSound', 'deathSound', 'canWalk', 'canFollow', 'attackable', 'aggressive', 'canAttackBack', 'retreats', 'poisonous', 'poisonImmune'];
			
			for (var i=0; i<data.length; i++) {
				for (var j=0; j<unusedKeys.length; j++) {
					delete data[i][unusedKeys[j]];
				}
			}
			
			npcDefinitions = data;
			
			$(searchMonster).typeahead({
				source: data,
				items: 10,
				autoSelect: true,
				displayText: getItemDisplay
			}).change(function () {
				var current = $(searchMonster).typeahead('getActive');
				
				if (current && $(searchMonster).val() == getItemDisplay(current)) {
					var drops = getDropsFromNpcId(current.id);
					
					$(searchMonsterResult).removeClass('hide').html(
						mustache.render(tmplMonster, {
							item: current,
							drops: drops
						})
					);
				}
			});
		});
	}
	
	function fetchNpcDrops () {
		$.getJSON(npcDropsUrl, function (data) {
			finishLoad();
			npcDrops = data;
		});
	}
	
	function getDropsFromNpcId (id) {
		var npcDropsFilter = npcDrops.filter(function (item) {
			return item.npcId == id;
		});
		
		if (npcDropsFilter && npcDropsFilter[0] && npcDropsFilter[0].drops) {
			var drops = [],
				dropIndex = [],
				dropCount = {},
				
				hasRareDrop = npcDropsFilter[0].rareTableAccess;
			
			npcDropsFilter = npcDropsFilter[0].drops;
			
			if (hasRareDrop) {
				npcDropsFilter = npcDropsFilter.concat(rareDrops);
			}
			
			for (var i=0; i<npcDropsFilter.length; i++) {
				var drop = npcDropsFilter[i],
					dropKey = JSON.stringify({
						id: drop.id,
						chance: drop.chance,
						count: drop.count
					}),
					dropItem = items.filter(function (item) {
						return item.id == drop.id;
					});
				
				if (dropCount[drop.chance]) {
					dropCount[drop.chance]++;
				}
				else {
					dropCount[drop.chance] = 1;
				}
				
				if (dropItem && dropItem[0] && dropIndex.indexOf(dropKey) == -1) {
					drops.push({
						id: drop.id,
						name: dropItem[0].name,
						chance: drop.chance,
						chancePercent: 0,
						count: (drop.count + '').split(',').join(', '),
						isRare: drop.isRare
					});
					
					dropIndex.push(dropKey);
				}
			}
			
			for (var i=0; i<drops.length; i++) {
				var drop = drops[i];
				
				if (drop.chance == 2) {
					drop.chance = dropCount[2];
				}
				else if (drop.chance == 3) {
					drop.chance = dropCount[3] * 20;
				}
				else if (drop.chance == 4 || drop.chance == 6 || drop.chance == 8) {
					drop.chance = dropCount[drop.chance] * 100;
				}
				else if (drop.chance == 7 || drop.chance == 9) {
					drop.chance = dropCount[drop.chance] * 128;
				}
				else if (drop.chance == 5) {
					drop.chance = dropCount[5] * 200;
				}
				
				drop.chancePercent = (1 / drop.chance * 100).toFixed(4);
			}
			
			return drops;
		}
		else {
			return [];
		}
	}
	
	function fetchItems () {
		$.get(itemsUrl, function (data) {
			finishLoad();
			
			data = data.split('\n');
			
			for (var i=0; i<data.length; i++) {
				var itemArray = data[i].split(':'),
					id = $.trim(itemArray[0]);
				
				if (itemArray && itemArray[0] && itemArray[1]) {
					var itemName = itemArray[1],
						itemDesc = $.trim(itemName).match(/ [A-Z0-9].+/);
					
					if (itemDesc && itemDesc[0]) {
						itemDesc = itemDesc[0];
						itemName = itemArray[1].replace(itemDesc, '');
					}
					else {
						itemDesc = itemName;
					}
					
					itemName = $.trim(itemName);
					
					if (id == 985 || id == 986) {
						itemName += ' (Tooth)';
					}
					else if (id == 987 || id == 988) {
						itemName += ' (Loop)';
					}
					
					items.push({
						id: id,
						name: itemName,
						desc: itemDesc
					});
				}
			}
			
			$(searchItem).typeahead({
				source: items,
				items: 10,
				autoSelect: true,
				displayText: getItemDisplay
			}).change(function () {
				var current = $(searchItem).typeahead('getActive');
				
				if (current && $(searchItem).val() == getItemDisplay(current)) {
					var npcs = getNpcsFromDropId(current.id);
					
					$(searchItemResult).removeClass('hide').html(
						mustache.render(tmplItem, {
							item: current,
							npcs: npcs
						})
					);
				}
			});
		});
	}
	
	function getNpcsFromDropId (id) {
		var npcDropsFilter = npcDrops.filter(function (item) {
			var result = item.drops.filter(function (itemJ) {
				return itemJ.id == id;
			});
			
			if (result && result[0]) {
				return true;
			}
			else {
				return false;
			}
		});
		
		if (npcDropsFilter && npcDropsFilter[0]) {
			var npcs = [];
			
			for (var i=0; i<npcDropsFilter.length; i++) {
				var npcId = npcDropsFilter[i].npcId,
					npc = npcDefinitions.filter(function (item) {
						return item.id == npcId;
					});
				
				if (npc && npc[0] && npcs.indexOf(npc[0].name) == -1) {
					npcs.push(npc[0].name);
				}
			}
			
			return npcs;
		}
		else {
			return [];
		}
	}
	
	function fetchRareDrops () {
		$.getJSON(rareDropsUrl, function (data) {
			finishLoad();
			
			data = data.drops;
			
			for (var i=0; i<data.length; i++) {
				data[i]['isRare'] = true;
			}
			
			rareDrops = data;
		});
	}
	
	$('#commit-info-trigger').on('click', function () {
		$('#commit-info-box').toggleClass('hide');
	});
	
})(document, window, Mustache);
