import {it,expect,vi,afterEach} from 'vitest';
const mocks=vi.hoisted(()=>({create:vi.fn(),reserve:vi.fn().mockResolvedValue('usage-test'),settle:vi.fn().mockResolvedValue(undefined)}));
vi.mock('openai',()=>({default:class {responses={create:mocks.create};}}));
vi.mock('../src/cost/budget.js',()=>({reserveUsage:mocks.reserve,settleUsage:mocks.settle}));
import {env} from '../src/config/env.js';
import {generateJoint,MemorySchema} from '../src/services/intelligence.js';
import {emptyMemory} from '../src/memory/compact.js';
const original={AI_TEST_ONLY:env.AI_TEST_ONLY,AI_TEST_CONTACT_IDS:env.AI_TEST_CONTACT_IDS,MOCK_AI:env.MOCK_AI,AI_DRY_RUN:env.AI_DRY_RUN,OPENAI_API_KEY:env.OPENAI_API_KEY};
afterEach(()=>{Object.assign(env,original);vi.clearAllMocks();});
function scope(){env.AI_TEST_ONLY=true;env.AI_TEST_CONTACT_IDS='test-contact';env.MOCK_AI=false;env.AI_DRY_RUN=false;env.OPENAI_API_KEY='test-fixture-only';}
it('accepts omitted locally controlled persona and tone but rejects invalid values',()=>{
  const {persona,tone,...memory}=emptyMemory();
  expect(MemorySchema.parse(memory)).toMatchObject({persona:'JULLY',tone:{}});
  expect(MemorySchema.safeParse({...memory,persona:'OTHER'}).success).toBe(false);
});
it('never invokes the provider or reserves credits for other contacts',async()=>{
  scope();const result=await generateJoint({model:'gpt-4.1-mini',purpose:'draft',externalId:'other-contact',input:'Quero um site'});
  expect(result.dryRun).toBe(true);expect(mocks.create).not.toHaveBeenCalled();expect(mocks.reserve).not.toHaveBeenCalled();
});
it('fails closed when the test scope has no contact ID',async()=>{
  scope();const result=await generateJoint({model:'gpt-4.1-mini',purpose:'draft',input:'Quero um site'});
  expect(result.dryRun).toBe(true);expect(mocks.create).not.toHaveBeenCalled();
});
it('reserves and accounts for one mocked provider call only for the allowed contact',async()=>{
  scope();mocks.create.mockResolvedValueOnce({id:'mock-response',status:'completed',usage:{input_tokens:80,output_tokens:100,input_tokens_details:{cached_tokens:0}},output_text:JSON.stringify({reply:'Quais servicos sua empresa oferece?',risk:'low',requiresApproval:false,nextAction:'Confirmar servicos',memory:emptyMemory()})});
  const result=await generateJoint({model:'gpt-4.1-mini',purpose:'draft',externalId:'test-contact',input:'Quero um site'});
  expect(result.dryRun).toBe(false);expect(mocks.reserve).toHaveBeenCalledTimes(1);expect(mocks.create).toHaveBeenCalledTimes(1);expect(mocks.settle).toHaveBeenCalledTimes(1);
});
