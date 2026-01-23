import assert from 'node:assert/strict';
import test from 'node:test';
import { migratePhasesToElements, normalizeAppJsonToV2 } from '../src/utils/migrateAppJson';

test('migratePhasesToElements converts phases to ordered elements', () => {
  const legacyAppJson = {
    title: 'App Title',
    description: 'App Description',
    phases: [
      {
        id: 'phase-1',
        title: 'Phase 1',
        description: 'Phase 1 Description',
        elements: [
          {
            id: 'field-1',
            name: 'field1',
            type: 'text',
            label: 'Field 1',
            isRequired: true,
          },
        ],
        prompts: [
          { type: 'prompt', text: 'Ask about {field1}' },
          { type: 'aiInstructions', aiPromptProperty: 'Be concise' },
          { type: 'aiInstructions', aiPromptProperty: '   ' },
          { type: 'fixedResponse', text: 'Fixed 1' },
          { type: 'fixedResponse', aiPromptProperty: 'Fixed 2' },
        ],
        scoredPhase: true,
        skipPhase: false,
        rubric: 'Rubric text',
        minScore: 2,
      },
    ],
  };

  const migrated = migratePhasesToElements(legacyAppJson);
  assert.equal(migrated.title, 'App Title');
  assert.equal(migrated.description, 'App Description');

  const [titleEl, descEl, fieldEl, aiEl, fixedEl, scoringEl] = migrated.elements;
  assert.equal(titleEl.type, 'title');
  assert.equal(titleEl.text, 'Phase 1');
  assert.equal(descEl.type, 'title');
  assert.equal(descEl.text, 'Phase 1 Description');

  assert.deepStrictEqual(fieldEl, legacyAppJson.phases[0].elements[0]);

  assert.equal(aiEl.type, 'aiResponse');
  assert.deepStrictEqual(aiEl.instructions, [
    { text: 'Ask about {field1}', conditionalLogic: undefined },
    { text: 'Be concise', conditionalLogic: undefined },
  ]);

  assert.equal(fixedEl.type, 'fixedResponse');
  assert.equal(fixedEl.text, 'Fixed 1\nFixed 2');

  assert.equal(scoringEl.type, 'scoring');
  assert.equal(scoringEl.isRequired, true);
  assert.equal(scoringEl.rubric, 'Rubric text');
  assert.equal(scoringEl.minScore, 2);
});

test('normalizeAppJsonToV2 returns existing elements without migration', () => {
  const elements = [
    { id: 'e1', name: 'field1', type: 'text', label: 'Field 1', isRequired: false },
  ];
  const appJson = { title: 'App', elements };

  const normalized = normalizeAppJsonToV2(appJson);
  assert.strictEqual(normalized.elements, elements);
  assert.equal(normalized.title, 'App');
});

test('normalizeAppJsonToV2 handles malformed input', () => {
  const normalized = normalizeAppJsonToV2({ title: 'Empty' });
  assert.equal(normalized.title, 'Empty');
  assert.deepStrictEqual(normalized.elements, []);
});
