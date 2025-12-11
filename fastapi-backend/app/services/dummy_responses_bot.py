# app/services/dummy_responses_bot.py

import asyncio
import random
import string
from dataclasses import dataclass, field
from typing import List, Optional
from urllib.parse import urlencode

from playwright.async_api import (
    async_playwright,
    Page,
    Response,
    TimeoutError as PlaywrightTimeoutError,
)


# ---------------- CONFIG / DATACLASS ----------------


@dataclass
class DummyBotConfig:
    base_form_url: str
    org_id: str
    project_id: str
    survey_id: str
    total_respondents: int = 10
    concurrency: int = 5
    max_steps_per_respondent: int = 80
    headless: bool = True
    debug: bool = False
    screenshot_on_error: bool = True
    response_timeout: int = 15000  # ms to wait for response POST
    thank_you_snippets: List[str] = field(
        default_factory=lambda: [
            "thank you",
            "you have already completed",
            "survey completed",
            "thanks for your time",
            "successfully submitted",
            "submission successful",
        ]
    )


QUESTION_SELECTOR = "[data-question-id]"
NEXT_BUTTON_SELECTOR = "button[data-role='next']"
SUBMIT_BUTTON_SELECTOR = "button[data-role='submit']"


# ---------------- HELPERS ----------------


def build_form_url(cfg: DummyBotConfig, dummy_id: int) -> str:
    """Build the survey form URL with query parameters."""
    params = {
        "org_id": cfg.org_id,
        "projects": cfg.project_id,
        "survey_id": cfg.survey_id,
        "user_id": f"dummy_{dummy_id}",
        "campaign_type": "test",
    }
    return f"{cfg.base_form_url}?{urlencode(params)}"


def rand_text(min_len=8, max_len=30):
    """Generate random text for text inputs."""
    words = ["test", "dummy", "auto", "response", "sample", "feedback", "quality", "service"]
    out = " ".join(random.choice(words) for _ in range(random.randint(2, 5)))
    extra = "".join(random.choice(string.ascii_lowercase) for _ in range(4))
    return (out + " " + extra)[:max_len]


def rand_number(min_v=1, max_v=10):
    """Generate random number string."""
    return str(random.randint(min_v, max_v))


async def page_has_ended(page: Page, thank_you_snippets: List[str]) -> bool:
    """Check if the page shows a completion message."""
    try:
        body = (await page.text_content("body")) or ""
        low = body.lower()
        return any(s in low for s in thank_you_snippets)
    except Exception:
        return False


async def answer_question_block(page: Page, q_el, debug=False) -> None:
    """Answer a single question block based on its type."""
    try:
        qtype = (await q_el.get_attribute("data-q-type")) or ""
        qid = (await q_el.get_attribute("data-question-id")) or "unknown"

        if debug:
            print(f"  → Answering Q={qid}, Type={qtype}")

        # Get all input elements
        radios = await q_el.query_selector_all("input[type='radio']:not([disabled])")
        checkboxes = await q_el.query_selector_all("input[type='checkbox']:not([disabled])")
        selects = await q_el.query_selector_all("select:not([disabled])")
        textareas = await q_el.query_selector_all("textarea:not([disabled])")
        text_inputs = await q_el.query_selector_all(
            "input[type='text']:not([disabled]), input:not([type]):not([disabled])"
        )
        number_inputs = await q_el.query_selector_all("input[type='number']:not([disabled])")

        # Handle radio buttons (single select)
        if radios:
            visible = [r for r in radios if await r.is_visible()]
            if visible:
                choice = random.choice(visible)
                await choice.scroll_into_view_if_needed()
                await page.wait_for_timeout(100)

                # Try clicking label first (safer for styled inputs)
                label = await choice.evaluate_handle("(el) => el.closest('label')")
                if label:
                    try:
                        await label.click(force=True, timeout=3000)
                    except Exception:
                        await choice.click(force=True, timeout=3000)
                else:
                    await choice.click(force=True, timeout=3000)

                if debug:
                    print("    ✓ Selected radio")

                # Handle "Other" text input if present
                other_input = await q_el.query_selector(
                    "input[type='text'][placeholder*='other' i]:not([disabled])"
                )
                if other_input and await other_input.is_visible():
                    await other_input.fill(rand_text())
                    if debug:
                        print("    ✓ Filled 'Other' text")

                return

        # Handle checkboxes (multi-select)
        if checkboxes:
            visible = [cb for cb in checkboxes if await cb.is_visible()]
            if visible:
                # Select 1-3 random checkboxes
                k = random.randint(1, min(3, len(visible)))
                for cb in random.sample(visible, k):
                    await cb.scroll_into_view_if_needed()
                    await page.wait_for_timeout(100)
                    try:
                        await cb.click(force=True, timeout=3000)
                    except Exception as e:
                        if debug:
                            print(f"    ⚠️ Failed to click checkbox: {e}")
                
                if debug:
                    print(f"    ✓ Selected {k} checkboxes")
            return

        # Handle dropdowns
        if selects:
            for sel in selects:
                options = await sel.query_selector_all("option")
                # Skip first option (usually placeholder)
                valid_opts = [opt for i, opt in enumerate(options) if i != 0]
                if valid_opts:
                    opt = random.choice(valid_opts)
                    val = await opt.get_attribute("value")
                    if val:
                        await sel.select_option(value=val)
                        if debug:
                            print("    ✓ Selected dropdown option")
            return

        # Handle textareas
        if textareas:
            for ta in textareas:
                await ta.fill(rand_text(20, 100))
                if debug:
                    print("    ✓ Filled textarea")
            return

        # Handle number inputs
        if number_inputs:
            for ni in number_inputs:
                await ni.fill(rand_number())
                if debug:
                    print("    ✓ Filled number")
            return

        # Handle text inputs
        if text_inputs:
            for ti in text_inputs:
                await ti.fill(rand_text())
                if debug:
                    print("    ✓ Filled text input")
            return

        if debug:
            print(f"    ⚠️ No inputs found for question type {qtype}")

    except Exception as e:
        if debug:
            print(f"    ❌ Error answering question: {e}")


async def answer_all_questions_on_page(page: Page, debug=False) -> int:
    """Answer all visible questions on the current page."""
    q_blocks = await page.query_selector_all(QUESTION_SELECTOR)
    answered = 0

    for q in q_blocks:
        try:
            if await q.is_visible():
                await answer_question_block(page, q, debug)
                answered += 1
        except Exception as e:
            print(f"[WARN] Failed to answer question: {e}")

    if debug and answered > 0:
        print(f"  Answered {answered} questions")

    return answered


# ---------------- ONE RESPONDENT ----------------


async def run_one_respondent(idx: int, cfg: DummyBotConfig) -> dict:
    """
    Run one bot respondent through the survey.
    
    Returns:
        dict with keys: respondent_id, success, steps_taken, error, response_saved
    """
    respondent_id = f"dummy_{idx+1}"
    url = build_form_url(cfg, idx + 1)
    print(f"[BOT] Respondent #{idx+1} -> {url}")

    steps_taken = 0
    response_saved = False
    response_post_url = None

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=cfg.headless)
        context = await browser.new_context()
        page = await context.new_page()

        # 🔹 AUTO-ACCEPT ALL DIALOGS (confirm, alert, etc.)
        page.on("dialog", lambda dialog: asyncio.create_task(dialog.accept()))

        response_saved = False
        response_statuses = []

        async def handle_response(response: Response):
            nonlocal response_saved, response_statuses
            if "/api/post-gres-apis/responses" in response.url:
                if response.request.method == "POST":
                    response_statuses.append(response.status)
                    # Consider 200, 201, or 307 (redirect) as potential success
                    if response.status in [200, 201]:
                        response_saved = True
                        if cfg.debug:
                            print(f"[BOT] #{idx+1}: ✅ Response saved (status {response.status})")
                    elif response.status == 307:
                        if cfg.debug:
                            print(f"[BOT] #{idx+1}: 🔄 Response redirected (307), checking redirect...")
                        # Wait for the redirect to complete
                        await page.wait_for_timeout(1000)

        page.on("response", handle_response)

        try:
            # Navigate to survey
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)

            # Wait for survey UI to appear
            try:
                await page.wait_for_selector(
                    f"{QUESTION_SELECTOR}, {NEXT_BUTTON_SELECTOR}, {SUBMIT_BUTTON_SELECTOR}",
                    timeout=30000,
                )
            except PlaywrightTimeoutError:
                msg = "Timed out waiting for survey form to load"
                print(f"[BOT] #{idx+1}: ❌ {msg}")
                if cfg.screenshot_on_error:
                    await page.screenshot(
                        path=f"dummy_error_{respondent_id}_load.png", full_page=True
                    )
                return {
                    "respondent_id": respondent_id,
                    "success": False,
                    "steps_taken": 0,
                    "error": msg,
                    "response_saved": False,
                }

            # Main answering loop
            for step in range(1, cfg.max_steps_per_respondent + 1):
                steps_taken = step

                if cfg.debug:
                    print(f"[BOT] #{idx+1}: Step {step}")

                # Check if already completed
                if await page_has_ended(page, cfg.thank_you_snippets):
                    print(f"[BOT] #{idx+1}: Reached end at step {step}")
                    return {
                        "respondent_id": respondent_id,
                        "success": True,
                        "steps_taken": steps_taken,
                        "error": None,
                        "response_saved": response_saved,
                    }

                # Answer all questions on current page
                await answer_all_questions_on_page(page, cfg.debug)
                await page.wait_for_timeout(500)

                # Check for submit button
                submit = await page.query_selector(SUBMIT_BUTTON_SELECTOR)
                next_btn = await page.query_selector(NEXT_BUTTON_SELECTOR)

                if submit:
                    if cfg.debug:
                        print(f"[BOT] #{idx+1}: Found submit button, clicking...")

                    await submit.scroll_into_view_if_needed()
                    await page.wait_for_timeout(300)

                    # Click submit and wait for response POST
                    try:
                        async with page.expect_response(
                            lambda r: "/api/post-gres-apis/responses" in r.url 
                            and r.request.method == "POST",
                            timeout=cfg.response_timeout
                        ) as response_info:
                            await submit.click()

                        # Wait for response
                        api_response = await response_info.value
                        
                        if api_response.status in [200, 201]:
                            response_saved = True
                            if cfg.debug:
                                print(f"[BOT] #{idx+1}: ✅ Response saved successfully")
                        else:
                            print(f"[BOT] #{idx+1}: ⚠️ Response save failed (status {api_response.status})")

                    except PlaywrightTimeoutError:
                        print(f"[BOT] #{idx+1}: ⚠️ Timeout waiting for response POST")
                        # Continue anyway, maybe it succeeded

                    # Wait for UI to update
                    await page.wait_for_timeout(2000)

                    # Check if completed
                    if await page_has_ended(page, cfg.thank_you_snippets):
                        print(f"[BOT] #{idx+1}: Submitted and completed")
                    else:
                        print(f"[BOT] #{idx+1}: Submitted but no completion message")

                    return {
                        "respondent_id": respondent_id,
                        "success": True,
                        "steps_taken": steps_taken,
                        "error": None,
                        "response_saved": response_saved,
                    }

                # Check for next button
                if next_btn:
                    if cfg.debug:
                        print(f"[BOT] #{idx+1}: Clicking next button")
                    
                    await next_btn.scroll_into_view_if_needed()
                    await page.wait_for_timeout(200)
                    await next_btn.click()
                    await page.wait_for_timeout(800)
                    continue

                # No navigation buttons found
                if cfg.debug:
                    print(f"[BOT] #{idx+1}: No next/submit button at step {step}")

                await page.wait_for_timeout(1000)

                # Check if ended without explicit submit
                if await page_has_ended(page, cfg.thank_you_snippets):
                    print(f"[BOT] #{idx+1}: End detected without explicit submit")
                    return {
                        "respondent_id": respondent_id,
                        "success": True,
                        "steps_taken": steps_taken,
                        "error": None,
                        "response_saved": response_saved,
                    }

                # Check if there are still questions
                q_blocks = await page.query_selector_all(QUESTION_SELECTOR)
                if not q_blocks:
                    msg = "No questions and no nav buttons; stopping"
                    print(f"[BOT] #{idx+1}: ❌ {msg}")
                    if cfg.screenshot_on_error:
                        await page.screenshot(
                            path=f"dummy_error_{respondent_id}_stuck.png",
                            full_page=True,
                        )
                    return {
                        "respondent_id": respondent_id,
                        "success": False,
                        "steps_taken": steps_taken,
                        "error": msg,
                        "response_saved": response_saved,
                    }

            # Max steps exceeded
            msg = "Max steps per respondent exceeded"
            print(f"[BOT] #{idx+1}: ❌ {msg}")
            if cfg.screenshot_on_error:
                await page.screenshot(
                    path=f"dummy_error_{respondent_id}_maxsteps.png",
                    full_page=True,
                )
            return {
                "respondent_id": respondent_id,
                "success": False,
                "steps_taken": steps_taken,
                "error": msg,
                "response_saved": response_saved,
            }

        except Exception as e:
            msg = str(e)
            print(f"[BOT] #{idx+1} ERROR:", msg)
            if cfg.screenshot_on_error:
                try:
                    await page.screenshot(
                        path=f"dummy_error_{respondent_id}_exception.png",
                        full_page=True,
                    )
                except Exception:
                    pass
            return {
                "respondent_id": respondent_id,
                "success": False,
                "steps_taken": steps_taken,
                "error": msg,
                "response_saved": response_saved,
            }
        finally:
            await context.close()
            await browser.close()
            print(f"[BOT] #{idx+1} done.")


# ---------------- MANY RESPONDENTS ----------------


async def generate_dummy_responses(cfg: DummyBotConfig) -> dict:
    """
    Run multiple bots in batches and return summary statistics.
    
    Returns:
        dict with summary of results including success rate and errors
    """
    print(f"\n[BOT] ========== STARTING GENERATION ==========")
    print(f"[BOT] Total respondents: {cfg.total_respondents}")
    print(f"[BOT] Concurrency: {cfg.concurrency}")
    print(f"[BOT] Debug mode: {cfg.debug}")
    print(f"[BOT] Headless: {cfg.headless}")
    print(f"[BOT] Screenshots on error: {cfg.screenshot_on_error}")
    print(f"[BOT] ==========================================\n")

    results = []

    # Run in batches
    for i in range(0, cfg.total_respondents, cfg.concurrency):
        batch_size = min(cfg.concurrency, cfg.total_respondents - i)
        batch_num = (i // cfg.concurrency) + 1
        total_batches = (cfg.total_respondents + cfg.concurrency - 1) // cfg.concurrency
        
        print(f"\n[BOT] Starting batch {batch_num}/{total_batches} ({batch_size} respondents)")
        
        batch = [run_one_respondent(i + j, cfg) for j in range(batch_size)]
        batch_results = await asyncio.gather(*batch)
        results.extend(batch_results)
        
        print(f"[BOT] Batch {batch_num} completed\n")

    # Calculate statistics
    successful = sum(1 for r in results if r["success"])
    failed = len(results) - successful
    responses_saved = sum(1 for r in results if r.get("response_saved", False))

    error_types = {}
    for r in results:
        if not r["success"] and r["error"]:
            key = r["error"][:80]
            error_types[key] = error_types.get(key, 0) + 1

    summary = {
        "total": cfg.total_respondents,
        "successful": successful,
        "failed": failed,
        "responses_saved": responses_saved,
        "responses_not_saved": successful - responses_saved,
        "success_rate": f"{(successful / cfg.total_respondents) * 100:.1f}%",
        "save_rate": f"{(responses_saved / successful * 100):.1f}%" if successful > 0 else "0%",
        "error_types": error_types,
        "failures": [
            {
                "respondent_id": r["respondent_id"],
                "error": r["error"],
                "steps": r["steps_taken"],
                "response_saved": r.get("response_saved", False),
            }
            for r in results
            if not r["success"]
        ][:10],  # Show first 10 failures
        "save_issues": [
            {
                "respondent_id": r["respondent_id"],
                "steps": r["steps_taken"],
            }
            for r in results
            if r["success"] and not r.get("response_saved", False)
        ][:10],  # Show first 10 save issues
    }

    # Print summary
    print("\n[BOT] ========== GENERATION COMPLETE ==========")
    print(f"[BOT] Success: {successful}/{cfg.total_respondents} ({summary['success_rate']})")
    print(f"[BOT] Failed: {failed}")
    print(f"[BOT] Responses saved: {responses_saved}/{successful} ({summary['save_rate']})")
    
    if responses_saved < successful:
        print(f"[BOT] ⚠️ WARNING: {successful - responses_saved} surveys completed but responses not saved!")
    
    if error_types:
        print("\n[BOT] Common errors:")
        for err, count in sorted(error_types.items(), key=lambda x: -x[1])[:5]:
            print(f"  - {err}: {count}x")
    
    if summary["save_issues"]:
        print("\n[BOT] Respondents with save issues:")
        for issue in summary["save_issues"][:5]:
            print(f"  - {issue['respondent_id']}: completed in {issue['steps']} steps but response not saved")
    
    print("[BOT] ==========================================\n")

    return summary

