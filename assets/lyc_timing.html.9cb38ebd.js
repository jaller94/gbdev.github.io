import{r as l,o,c as r,a as s,b as a,F as i,e,d as t}from"./app.7b623df0.js";import{_ as p}from"./plugin-vue_export-helper.21dcd24c.js";var c="/images/pandocs_timing.png",h="/images/first_example.png",u="/images/main_thread.png",d="/images/problem.png",m="/images/bad_fix.png",b="/images/double_spinloop.png",y="/images/wasted_scanline.png",f="/images/long_cycle_count.png",g="/images/short_cycle_count.png",E="/images/86_cycle_count.png",w="/images/call_offset.png";const D={},F=s("h1",{id:"the-timing-of-lyc-stat-handlers",tabindex:"-1"},[s("a",{class:"header-anchor",href:"#the-timing-of-lyc-stat-handlers","aria-hidden":"true"},"#"),e(" The Timing of LYC STAT Handlers")],-1),k=e("Written by "),_={href:"https://github.com/rondnelson99/",target:"_blank",rel:"noopener noreferrer"},T=e("Ron Nelson"),v=s("hr",null,null,-1),C=s("p",null,"Raster effects are probably the greatest asset that retro game consoles have. The fact that the PPU generates the image right as it is displayed allows many special effects to be created by modifying the drawing parameters while the image is being drawn. However, unlike some consoles like the SNES, raster effects on the Game Boy have to be performed by the CPU. The easiest way to implement raster effects is with the rLYC register at $FF45. Here\u2019s how the Pan Docs explain this register\u2019s simple function:",-1),A={id:"ff45-lyc-ly-compare-r-w",tabindex:"-1"},x=s("a",{class:"header-anchor",href:"#ff45-lyc-ly-compare-r-w","aria-hidden":"true"},"#",-1),H=e(),S={href:"https://gbdev.io/pandocs/Scrolling.html#ff45---lyc-ly-compare-rw",target:"_blank",rel:"noopener noreferrer"},L=e("FF45 - LYC (LY Compare) (R/W)"),B=s("p",null,"The Game Boy permanently compares the value of the LYC and LY registers. When both values are identical, the \u201CLYC=LY\u201D flag in the STAT register is set, and (if enabled) a STAT interrupt is requested.",-1),Y=t('<p>So, the basic setup for raster FX is as follows:</p><ol><li>Request an interrupt by setting rLYC to the appropriate scanline</li><li>The system will start your interrupt routine when that scanline begins</li><li>Perform your chosen effect by modifying PPU registers</li><li>Exit with reti</li></ol><p>This seems simple enough, but unfortunately, this process comes with significant caveats. So, here are some things to keep in mind:</p><p>All but the most complex of raster effects are registers that you change between scanlines. For that reason, you want to perform your register write while the screen is not being drawn, so during Hblank or OAM search. You may know that LYC interrupts are requested at the start of a scanline, which happens to be Mode 2 (OAM search). However, because of Mode 2\u2019s short duration combined with unreliability of interrupt timing, you will not reliably have enough time to perform your write. Therefore, you have to wait for the next Hblank to perform your register write. You also need to compensate for this by requesting an interrupt on the line before the one on which you wish to perform your effect. For instance, if I want to enable sprites at line 16 when my upper status bar finishes drawing, I would write 15 to rLYC.</p><p>Like I mentioned above, the time at which your handler will begin execution will be delayed by an inconsistent amount, which makes it difficult to determine when the beginning of Hblank will come. You\u2019ll see why this is and how this can be avoided later.</p><p>The final problem is perhaps the biggest one. It\u2019s common practice in Gameboy Development to use a STAT check to write to VRAM between scanlines. The typical way of doing this is to read STAT, and then reap up to 16 cycles of guaranteed VRAM access time. This method is great for copying small bits of data quickly, and uses little CPU time. However, if an LYC interrupt fires during one of those VRAM accesses, you can potentially take some of its VRAM-safe time and cause VRAM writes from the main thread to fail. However, this can be avoided with some careful planning.</p><h2 id="timing-with-diagrams-and-stuff" tabindex="-1"><a class="header-anchor" href="#timing-with-diagrams-and-stuff" aria-hidden="true">#</a> Timing, With Diagrams and Stuff</h2><p>First, let\u2019s look at the timing of the rendering itself, courtesy of the Pan Docs: <strong><img src="'+c+`" alt=""></strong> Note that:</p><ul><li>Each full scanline takes exactly 456 dots (114 cycles)</li><li>Mode 2 also takes a constant amount of time (20 cycles)</li><li>Hblank length varies wildly, and will often be nearly as long as or longer than the drawing phase</li><li>Hblank and OAM scan are mostly interchangeable, and long as you\u2019re not doing OAM pokes during Hblank</li><li>The worst-case Hblank takes a number of dots that is not divisible by 4. However, as far as I\u2019m aware, this still behaves like 88 dots in practice.</li></ul><p>Now, I will have a bunch of diagrams showing the timing of various situations. Each row represents exactly one scanline, and the columns show the individual cycles. Consider zooming in to better see these cycles. First, let\u2019s consider a simple LYC routine. It will disable sprites if called for line 128, but otherwise, it will enable them.</p><div class="language-asm ext-asm line-numbers-mode"><pre class="shiki" style="background-color:#2e3440ff;"><code><span class="line"><span style="color:#88C0D0;">LYC</span><span style="color:#ECEFF4;">:</span><span style="color:#D8DEE9FF;">:</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	</span><span style="color:#81A1C1;">push</span><span style="color:#D8DEE9FF;"> af</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	ldh a, [rLY]</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	cp </span><span style="color:#B48EAD;">128</span><span style="color:#D8DEE9FF;"> - </span><span style="color:#B48EAD;">1</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	jr z, .disableSprites</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D8DEE9FF;">	</span><span style="color:#616E88;">; enable sprites</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	ldh a, [rLCDC]</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	set LCDCB_OBJON, a</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	ldh [rLCDC], a</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	</span><span style="color:#81A1C1;">pop</span><span style="color:#D8DEE9FF;"> af</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	reti</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D8DEE9FF;">.disableSprites</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	ldh a, [rLCDC]</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	res LCDCB_OBJON, a</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	ldh [rLCDC], a</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	</span><span style="color:#81A1C1;">pop</span><span style="color:#D8DEE9FF;"> af</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	reti</span></span>
<span class="line"></span></code></pre><div class="line-numbers"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br><span class="line-number">14</span><br><span class="line-number">15</span><br><span class="line-number">16</span><br><span class="line-number">17</span><br><span class="line-number">18</span><br><span class="line-number">19</span><br></div></div>`,11),I=e("Note that this may not be an especially well-written LYC routine, but the actual logic of the routine itself is outside the scope of this tutorial. If that\u2019s what you\u2019re looking for, check out "),M={href:"https://github.com/gb-archive/DeadCScroll",target:"_blank",rel:"noopener noreferrer"},R=e("DeadCScroll"),V=e(" by Blitter Object. It uses the Hblank interrupt rather than the LYC interrupt, but it should still teach you some fundamentals. However, that tutorial does not attempt to solve the problems described below, so be wary of combining that tutorial\u2019s STAT routine with STAT-based VRAM accesses in the main thread."),j=t('<p>Here\u2019s how the timing of all this might look:</p><p><img src="'+h+'" alt=""></p><p>The 5 yellow cycles mark the time it takes for the system to prepare the interrupt. During this time, it has to push the program counter to the stack, disable interrupts, etc. Then, the actual interrupt routine can start.</p><p>Right now, there are a few problems here. The first is that the actual register write that the routine performs happens during the drawing phase. This is most likely undesirable, and could lead to graphical glitches like a partial sprite being displayed before it is cut off when sprites are disabled.</p><p>The other problem is what might be happening during the main thread:</p><p><img src="'+u+'" alt=""></p><p>This is the worst-case scenario for a STAT-based VRAM access. Here, the main thread reads rSTAT on the very last cycle of Hblank. After the brief processing of the value it read, the main loop may use the 16 guaranteed cycles of OAM scan to access VRAM. This just barely works out. But what happens if an interrupt is requested on that next cycle?</p><p><img src="'+d+'" alt=""></p><p>Oh no! The main thread is trying to access VRAM right in the middle of the drawing phase! This could lead to all sorts of glitches.</p><p>The solution is not too complicated, at least on paper. We just need to do all our register writes, and exit, during Hblank. This seems easy enough, since if you\u2019ve made it this far, you already know how to utilize the blanking periods to access VRAM. So what happens if you use that method?<img src="'+m+`" alt=""></p><p>Here, the long blue strip represents the time spent within the interrupt routine. Remember that many STAT routines will be much more complicated than the simple example above.</p><p>Once again, the VRAM access time overlaps with the Drawing phase. The problem here is that the register write, pop and reti all take some of those guaranteed cycles when it is possible to access VRAM. So, the real solution is to fully exit before the end of Hblank. There are two ways to do this. One is to wait for the Drawing phase before waiting for Hblank. This effectively catches the very start of Hblank, leaving plenty of time to exit. Here\u2019s how the earlier example might look using this method:</p><div class="language-asm ext-asm line-numbers-mode"><pre class="shiki" style="background-color:#2e3440ff;"><code><span class="line"><span style="color:#88C0D0;">LYC</span><span style="color:#ECEFF4;">:</span><span style="color:#D8DEE9FF;">:</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	</span><span style="color:#81A1C1;">push</span><span style="color:#D8DEE9FF;"> af</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	</span><span style="color:#81A1C1;">push</span><span style="color:#D8DEE9FF;"> hl</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	ldh a, [rLY]</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	cp </span><span style="color:#B48EAD;">128</span><span style="color:#D8DEE9FF;"> - </span><span style="color:#B48EAD;">1</span></span>
<span class="line"><span style="color:#D8DEE9FF;">jr z, .disableSprites</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D8DEE9FF;">	</span><span style="color:#616E88;">; enable sprites</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	ldh a, [rLCDC]</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	set LCDCB_OBJON, a</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	jr .finish</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D8DEE9FF;">.disableSprites</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	ldh a, [rLCDC]</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	res LCDCB_OBJON, a</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D8DEE9FF;">.finish</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	ld hl, rSTAT</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	.waitNotBlank</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	bit STATB_BUSY, [hl]</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	jr z, .waitNotBlank</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	.waitBlank</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	bit STATB_BUSY, [hl]</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	jr nz, .waitBlank</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D8DEE9FF;">	ldh [rLCDC], a</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	</span><span style="color:#81A1C1;">pop</span><span style="color:#D8DEE9FF;"> hl</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	</span><span style="color:#81A1C1;">pop</span><span style="color:#D8DEE9FF;"> af</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	reti</span></span>
<span class="line"></span></code></pre><div class="line-numbers"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br><span class="line-number">14</span><br><span class="line-number">15</span><br><span class="line-number">16</span><br><span class="line-number">17</span><br><span class="line-number">18</span><br><span class="line-number">19</span><br><span class="line-number">20</span><br><span class="line-number">21</span><br><span class="line-number">22</span><br><span class="line-number">23</span><br><span class="line-number">24</span><br><span class="line-number">25</span><br><span class="line-number">26</span><br><span class="line-number">27</span><br><span class="line-number">28</span><br><span class="line-number">29</span><br></div></div><p>See how this method never interferes with VRAM accesses in the main thread, even with the worst possible timing and the shortest of Hblanks:</p><p><img src="`+b+'" alt=""></p><p>Phew! This just barely works. There are only two cycles to spare! If there were multiple registers that needed updating, you might run into trouble. Normally, These really short Hblanks are the worst-case scenario that you always fear. However, in practice, Hblanks are normally much longer, often even longer than the drawing phase. Using this method, that can actually have unfortunate consequences:</p><p><img src="'+y+`" alt=""></p><p>This time, when all the processing was done, there was still plenty of time left in the scanline to safely exit. However, since Hblank was so long, the routine missed the check for the drawing window and wasted an entire scanline waiting for that Drawing -&gt; Hblank transition before it exited. Not only does this waste precious CPU time, but it also limits how often raster FX can be used throughout the frame. This method still works fine though, and can be an easy approach if you use Raster FX sparingly.</p><p>I\u2019m a bit of a perfectionist, so I usually like to strive for the absolute best method. In a perfect world, we would precisely know whether we have enough Hblank left to safely exit. There actually is a way to do that though! You just need to count exactly how long your routine takes, and make sure it always exits during Hblank. This comes with some caveats though. Most routines, if they haven\u2019t been specifically designed for this method, will take a variable amount of time. The main things you need to avoid are \u2018if\u2019 statements and loops. Specifically, if statements of this form are problematic:</p><div class="language-asm ext-asm line-numbers-mode"><pre class="shiki" style="background-color:#2e3440ff;"><code><span class="line"><span style="color:#D8DEE9FF;">	</span><span style="color:#616E88;">; test a condition here...</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D8DEE9FF;">jr nc, .skip </span><span style="color:#616E88;">; skip the next part unless Carry is set</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	</span><span style="color:#616E88;">; do something here, only if the previous operation set Carry</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D8DEE9FF;">.skip</span></span>
<span class="line"><span style="color:#D8DEE9FF;">	</span><span style="color:#616E88;">; continue on with the program.</span></span>
<span class="line"></span></code></pre><div class="line-numbers"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br></div></div><p>The problem here is that the code following this pattern may be run after a variable number of cycles have passed. If you need to use an if statement, always make it an if/else statement so that you can waste cycles in the \u2018else\u2019 portion and take the same number of cycles.</p><p>So now that you\u2019re ready to count the cycles of your handler, how long do you need to make the routine? Let\u2019s look at some more diagrams to figure this out!</p><p><img src="`+f+'" alt=""></p><p>Wow! That\u2019s a lot of cycles! Here, the routine takes exactly one scanline to complete, so the main thread does its writes at the same moment on the next scanline, with no idea what happened! If you count up all the cyan cycles, you\u2019ll see that there are 105 of them, and 109 if you count the \u2018reti\u2019. This extra time makes it possible to write to two or three registers safely, rather than just one. If you don\u2019t need all that time, you can make it shorter as well:</p><p><img src="'+g+'" alt=""></p><p>This time, I put the \u2018and\u2019 and \u2018jr\u2019 before the interrupt, so that when it resumes, it\u2019s all ready to start writing to VRAM. This interrupt routine is 87 cycles long, including the \u2018reti\u2019. This won\u2019t often prove especially useful though, because you never take any time during Hblank to actually do any register writes. However, you could use this if your routine has a case where it realizes that nothing actually needs to be written, and you can exit earlier.</p><p>From those two diagrams, you\u2019ll see that the 22 cycles of worst-case Hblank is the time you can use to write to any PPU registers, pop your registers back, and then exit with reti. These 22 cycles are cycle 88 through cycle 109, inclusive.</p><p>What if I told you that you could actually have your handler take only 86 cycles? Well, you can!</p><p><img src="'+E+'" alt=""></p><p>This seems bad, since the first cycle of the red bar, where the main thread may try to access VRAM, is potentially during the Drawing phase! This is also fine though. All instructions that access memory, whether through an immediate address or using a register pair as a pointer, take multiple cycles to complete. That\u2019s because the first cycle of every instruction is used to fetch the operation code itself. The memory access that the instruction performs is always in the 2nd, 3rd or 4th cycle of the instruction. In this situation, the 2nd cycle of the VRAM-accessible time is in Hblank, so this won\u2019t actually cause any problems.</p><h2 id="but-wait" tabindex="-1"><a class="header-anchor" href="#but-wait" aria-hidden="true">#</a> But Wait!</h2><p>The interrupt latency I showed earlier doesn\u2019t actually tell the full story. Before it even starts to service the interrupt, the system waits for the current instruction to finish. This is how that might look with the longest allowable routine:</p><p><img src="'+w+'" alt=""></p><p>Here, the first green block shows the system waiting 5 cycles for a \u2018call\u2019 instruction to finish. \u2018call\u2019 is the longest instruction at 6 cycles, so if the interrupt is requested just after it begins, the system will wait 5 cycles for it to complete. This seems bad, since the routine exited after the end of Hblank. However, this is actually fine! Those waiting cycles were not wasted; they were still 5 cycles of work that the main thread got done. So in the end, the main thread still gets its 20 cycles of VRAM-accessible time.</p><h2 id="pros-and-cons" tabindex="-1"><a class="header-anchor" href="#pros-and-cons" aria-hidden="true">#</a> Pros and Cons</h2><p>Thus far, I have presented two very different methods for making safe LYC handlers, and each have their pros and cons.</p><h2 id="double-busy-loop" tabindex="-1"><a class="header-anchor" href="#double-busy-loop" aria-hidden="true">#</a> Double-Busy-Loop</h2><p><strong>Pros</strong></p><ul><li>does not require all code to be constant-time</li><li>does not require tedious cycle-counting</li><li>may exit very early if the routine finishes quickly</li></ul><p><strong>Cons</strong></p><ul><li>does not provide enough Hblank time to safely write multiple registers</li><li>if the routine takes too long, it may miss mode 3 and waste an entire scanline before exiting</li></ul><h2 id="cycle-counting" tabindex="-1"><a class="header-anchor" href="#cycle-counting" aria-hidden="true">#</a> Cycle-counting</h2><p><strong>Pros</strong></p><ul><li>leaves more time for more complex logic in the routine</li><li>allows enough time during blanking to write to up to three registers</li><li>never takes longer than one scanline</li></ul><p><strong>Cons</strong></p><ul><li>requires all code to be constant-time</li><li>requires tedious cycle-counting</li><li>always takes close to an entire scanline, even if Hblank starts much sooner</li></ul><p>This suggests that the double-busy-loop method is good for extremely simple LYC routines that only need to write to one register, or routines that for some reason cannot be cycle-counted. If you need more time for calculations and more time to write to those registers, you can cycle-count your routine.</p><p>But what if you could combine both these methods? Enter the <strong>Hybrid Cycle-Counted Handler\u2122</strong>, a technique I came up with while writing this document.</p><h2 id="combining-approaches" tabindex="-1"><a class="header-anchor" href="#combining-approaches" aria-hidden="true">#</a> Combining Approaches</h2>',49),q=e("The goal of this method is to combine the maximum Hblank time that cycle-counting delivers, while still exiting early when Hblank is longer. Here is an example. If you\u2019ve read "),O={href:"https://github.com/gb-archive/DeadCScroll",target:"_blank",rel:"noopener noreferrer"},P=e("DeadCScroll"),N=e(", you\u2019ll recognise this as that tutorial\u2019s STAT Handler, modified to start at Mode 2 rather than Hblank, and be safe towards VRAM accesses in the main thread."),U=t(`<div class="language-asm ext-asm line-numbers-mode"><pre class="shiki" style="background-color:#2e3440ff;"><code><span class="line"><span style="color:#81A1C1;">push</span><span style="color:#D8DEE9FF;"> af </span><span style="color:#616E88;">; 4</span></span>
<span class="line"><span style="color:#81A1C1;">push</span><span style="color:#D8DEE9FF;"> hl </span><span style="color:#616E88;">; 8</span></span>
<span class="line"></span>
<span class="line"><span style="color:#616E88;">; obtain the pointer to the data pair</span></span>
<span class="line"><span style="color:#D8DEE9FF;">ldh a,[rLY] </span><span style="color:#616E88;">; 11</span></span>
<span class="line"><span style="color:#81A1C1;">inc</span><span style="color:#D8DEE9FF;"> a </span><span style="color:#616E88;">; 12</span></span>
<span class="line"><span style="color:#81A1C1;">add</span><span style="color:#D8DEE9FF;"> a,a </span><span style="color:#616E88;">; 13 ; double the offset since each line uses 2 bytes</span></span>
<span class="line"><span style="color:#D8DEE9FF;">ld l,a </span><span style="color:#616E88;">; 14</span></span>
<span class="line"><span style="color:#D8DEE9FF;">ldh a,[hDrawBuffer] </span><span style="color:#616E88;">; 17</span></span>
<span class="line"><span style="color:#81A1C1;">adc</span><span style="color:#D8DEE9FF;"> </span><span style="color:#B48EAD;">0</span><span style="color:#D8DEE9FF;"> </span><span style="color:#616E88;">; 19</span></span>
<span class="line"><span style="color:#D8DEE9FF;">ld h,a </span><span style="color:#616E88;">; 20 ; hl now points to somewhere in the draw buffer</span></span>
<span class="line"></span>
<span class="line"><span style="color:#81A1C1;">call</span><span style="color:#D8DEE9FF;"> UnconditionalRet </span><span style="color:#616E88;">;just waste 31 cycles while we wait for Hblank to maybe start</span></span>
<span class="line"><span style="color:#81A1C1;">call</span><span style="color:#D8DEE9FF;"> UnconditionalRet</span></span>
<span class="line"><span style="color:#81A1C1;">call</span><span style="color:#D8DEE9FF;"> UnconditionalRet</span></span>
<span class="line"><span style="color:#81A1C1;">nop</span><span style="color:#D8DEE9FF;"> </span><span style="color:#616E88;">; 51</span></span>
<span class="line"></span>
<span class="line"><span style="color:#616E88;">; now start trying to look for Hblank to exit early</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D8DEE9FF;">ldh a, [rSTAT]</span></span>
<span class="line"><span style="color:#81A1C1;">and</span><span style="color:#D8DEE9FF;"> STATF_BUSY</span></span>
<span class="line"><span style="color:#D8DEE9FF;">jr z, .setAndExit </span><span style="color:#616E88;">; 58</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D8DEE9FF;">ldh a, [rSTAT]</span></span>
<span class="line"><span style="color:#81A1C1;">and</span><span style="color:#D8DEE9FF;"> STATF_BUSY</span></span>
<span class="line"><span style="color:#D8DEE9FF;">jr z, .setAndExit </span><span style="color:#616E88;">; 65</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D8DEE9FF;">ldh a, [rSTAT]</span></span>
<span class="line"><span style="color:#81A1C1;">and</span><span style="color:#D8DEE9FF;"> STATF_BUSY</span></span>
<span class="line"><span style="color:#D8DEE9FF;">jr z, .setAndExit </span><span style="color:#616E88;">; 72</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D8DEE9FF;">ldh a, [rSTAT]</span></span>
<span class="line"><span style="color:#81A1C1;">and</span><span style="color:#D8DEE9FF;"> STATF_BUSY</span></span>
<span class="line"><span style="color:#D8DEE9FF;">jr z, .setAndExit </span><span style="color:#616E88;">; 79</span></span>
<span class="line"></span>
<span class="line"><span style="color:#81A1C1;">nop</span><span style="color:#D8DEE9FF;"> </span><span style="color:#616E88;">;waste 4 more cycles since there isn\u2019t time for another check</span></span>
<span class="line"><span style="color:#81A1C1;">nop</span></span>
<span class="line"><span style="color:#81A1C1;">nop</span></span>
<span class="line"><span style="color:#81A1C1;">nop</span><span style="color:#D8DEE9FF;"> </span><span style="color:#616E88;">; 83</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D8DEE9FF;">.setAndExit</span></span>
<span class="line"><span style="color:#616E88;">; set the scroll registers</span></span>
<span class="line"><span style="color:#D8DEE9FF;">ld a,[hl+] </span><span style="color:#616E88;">; 85</span></span>
<span class="line"><span style="color:#D8DEE9FF;">ldh [rSCY],a </span><span style="color:#616E88;">; 88</span></span>
<span class="line"><span style="color:#D8DEE9FF;">ld a,[hl+] </span><span style="color:#616E88;">; 90</span></span>
<span class="line"><span style="color:#D8DEE9FF;">ldh [rSCX],a </span><span style="color:#616E88;">; 93 </span></span>
<span class="line"></span>
<span class="line"><span style="color:#81A1C1;">pop</span><span style="color:#D8DEE9FF;"> hl </span><span style="color:#616E88;">; 97</span></span>
<span class="line"><span style="color:#81A1C1;">pop</span><span style="color:#D8DEE9FF;"> af </span><span style="color:#616E88;">; 100</span></span>
<span class="line"><span style="color:#D8DEE9FF;">reti </span><span style="color:#616E88;">; 104</span></span>
<span class="line"></span></code></pre><div class="line-numbers"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br><span class="line-number">14</span><br><span class="line-number">15</span><br><span class="line-number">16</span><br><span class="line-number">17</span><br><span class="line-number">18</span><br><span class="line-number">19</span><br><span class="line-number">20</span><br><span class="line-number">21</span><br><span class="line-number">22</span><br><span class="line-number">23</span><br><span class="line-number">24</span><br><span class="line-number">25</span><br><span class="line-number">26</span><br><span class="line-number">27</span><br><span class="line-number">28</span><br><span class="line-number">29</span><br><span class="line-number">30</span><br><span class="line-number">31</span><br><span class="line-number">32</span><br><span class="line-number">33</span><br><span class="line-number">34</span><br><span class="line-number">35</span><br><span class="line-number">36</span><br><span class="line-number">37</span><br><span class="line-number">38</span><br><span class="line-number">39</span><br><span class="line-number">40</span><br><span class="line-number">41</span><br><span class="line-number">42</span><br><span class="line-number">43</span><br><span class="line-number">44</span><br><span class="line-number">45</span><br><span class="line-number">46</span><br><span class="line-number">47</span><br><span class="line-number">48</span><br><span class="line-number">49</span><br><span class="line-number">50</span><br></div></div><p>Once the handler finishes its logic, the handler delays cycles until it reaches the window then Hblank might start. With a 5-cycle offset due to a \u2018call\u2019, and the longest possible Hblank, the earliest Hblank might start is cycle 54, so that\u2019s the first attempt to read rSTAT. It keeps checking rSTAT until even in the worst-case scenario, it knows that Hblank will start. Then, it uses that time to write the scroll registers and exit. This way, it can still exit early, as long as the Hblank length permits. This routine takes 104 cycles in the worst-case scenario, but may take as few as 79 if Hblank comes sooner.</p><p>The reason that the double-busy-loop method requires checking for Mode 3 but this method does not is that the double-busy-loop method is not cycle-counted, so you might be at the very end of Hblank which is problematic. Since this method is cycle-counted, you know that if Hblank has begun, you are at or near the start of it.</p><p>If we make a similar list of pros and cons for this method, this is what it might look like:</p><h2 id="hybrid-cycle-counting" tabindex="-1"><a class="header-anchor" href="#hybrid-cycle-counting" aria-hidden="true">#</a> Hybrid cycle-counting</h2><p><strong>Pros</strong></p><ul><li>may exit very early if Hblank is longer</li><li>allows enough time during blanking to write to up to three registers</li><li>never takes longer than one scanline</li></ul><p><strong>Cons</strong></p><ul><li>requires all code to be constant-time</li><li>requires tedious cycle-counting</li></ul><p>This method can work well in many circumstances, and is especially suited to frequent effects that modify multiple registers and need to exit quickly to avoid taking too much CPU time. This method can even work reasonably well when used on every scanline through the Mode 2 interrupt.</p><p>All three of these methods can generate great-looking effects, but I think the third one is an especially attractive option.</p><p>Congrats! You made it to the end of the tutorial! I bet you\u2019re tired of reading it, and I\u2019m tired of writing it too. So thanks for reading, see you next time!</p>`,12);function z(W,J){const n=l("ExternalLinkIcon");return o(),r(i,null,[F,s("p",null,[k,s("a",_,[T,a(n)])]),v,C,s("blockquote",null,[s("h2",A,[x,H,s("a",S,[L,a(n)])]),B]),Y,s("p",null,[I,s("a",M,[R,a(n)]),V]),j,s("p",null,[q,s("a",O,[P,a(n)]),N]),U],64)}var $=p(D,[["render",z]]);export{$ as default};
