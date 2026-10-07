async page => {
 const check=(value,message)=>{if(!value)throw new Error(message)};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8501');
 await page.waitForFunction(()=>document.getElementById('dataLabel').textContent.startsWith('Trained'));
 check(await page.locator('#attackPool .op').count()===40,'Attack roster');
 await page.getByRole('button',{name:'Add Ash to Attack',exact:true}).focus();
 await page.keyboard.press('Enter');
 check(await page.locator('#attackCount').textContent()==='1 / 5','Keyboard add');
 check(await page.locator('.rec-card').count()===3,'Three recommendations');
 const ranking=await page.evaluate(()=>{
 const expected=attackers.filter(op=>op!=='Ash'&&state.model.operators.includes(asModel(op))).map(op=>({op,...effects(op,'Attack')})).sort((a,b)=>b.total-a.total).slice(0,3).map(x=>x.op);
 return JSON.stringify(expected)===JSON.stringify([...document.querySelectorAll('.rec-card strong')].map(x=>x.textContent));});
 check(ranking,'Ranking follows original formula');
 await page.locator('#attackSearch').fill('Therm');
 check(await page.locator('#attackPool .op').count()===1,'Search');
 await page.locator('#attackSearch').fill('');
 await page.locator('#attackPool [data-operator="Sledge"]').dragTo(page.locator('#attackTeam'));
 check(await page.locator('#attackCount').textContent()==='2 / 5','Drag into team');
 await page.locator('#attackTeam [data-operator="Sledge"]').dragTo(page.locator('#attackPool'),{targetPosition:{x:2,y:2}});
 check(await page.locator('#attackCount').textContent()==='1 / 5','Drag back to pool');
 await page.locator('#randomTeam').click();
 check(await page.locator('#defenseTeam .op').count()===5,'Random opposing team');
 await page.locator('#openSide').selectOption('Defense');
 check((await page.locator('#recPrompt').textContent()).includes('complete'),'Full team state');
 await page.getByRole('button',{name:'Remove Smoke from Defense',exact:true}).count().then(async n=>{if(n)await page.getByRole('button',{name:'Remove Smoke from Defense',exact:true}).click();else await page.locator('#defenseTeam .op').first().click()});
 check(await page.locator('.rec-card').count()===3,'Defense recommendations');
 await page.locator('#defensePool .op').first().click();
 await page.locator('#defensePool .op').first().click();
 check(await page.locator('#defenseTeam .op').count()===5,'Five-pick limit');
 page.once('dialog',d=>d.dismiss());await page.locator('#clear').click();
 check(await page.locator('#attackTeam .op').count()===1,'Reset cancellation');
 page.once('dialog',d=>d.accept());await page.locator('#clear').click();
 check(await page.locator('.team .op').count()===0,'Reset both teams');
 await page.locator('#openSide').selectOption('Attack');
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow at '+width);
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'Add Ash to Attack',exact:true}).click();
 await page.locator('#randomTeam').click();
 await page.screenshot({path:'../../outputs/siege-draft-desktop.png',fullPage:true,timeout:10000});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'../../outputs/siege-draft-mobile.png',fullPage:true,timeout:10000});
 check(errors.length===0,'Runtime errors: '+errors.join(','));
 return 'PASS: keyboard/tap selection, both rankings, drag/drop, search, randomize, capacity, reset confirmation, and 5 responsive widths. No JavaScript errors.';
}


