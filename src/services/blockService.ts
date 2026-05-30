import { supabase, isMockMode } from "../lib/supabase";
import { mockDb } from "./mockDb";
import type { Block, Profile } from "./mockDb";

export interface BlockWithProfiles extends Block {
  blocker?: Profile;
  blocked?: Profile;
}

class BlockServiceClass {
  public async getBlockedUsers(userId: string): Promise<{ data: string[]; error: any }> {
    if (isMockMode) {
      const blocks = mockDb.getBlocks();
      const blockedIds = blocks
        .filter((b) => b.blocker_id === userId)
        .map((b) => b.blocked_id);
      return { data: blockedIds, error: null };
    } else {
      const { data, error } = await supabase
        .from("blocks")
        .select("blocked_id")
        .eq("blocker_id", userId);

      if (error) return { data: [], error };
      return { data: (data || []).map((b: any) => b.blocked_id), error: null };
    }
  }

  public async blockUser(blockerId: string, blockedId: string): Promise<{ data: any; error: any }> {
    if (isMockMode) {
      const blocks = mockDb.getBlocks();
      const existing = blocks.find(b => b.blocker_id === blockerId && b.blocked_id === blockedId);
      if (existing) {
        return { data: existing, error: null };
      }

      const newBlock: Block = {
        id: "blk-" + Math.random().toString(36).substr(2, 9),
        blocker_id: blockerId,
        blocked_id: blockedId,
        created_at: new Date().toISOString()
      };

      mockDb.saveBlocks([...blocks, newBlock]);
      window.dispatchEvent(new CustomEvent("kb_blocks_updated"));
      return { data: newBlock, error: null };
    } else {
      const { data, error } = await supabase
        .from("blocks")
        .insert({ blocker_id: blockerId, blocked_id: blockedId })
        .select()
        .single();

      return { data, error };
    }
  }

  public async unblockUser(blockerId: string, blockedId: string): Promise<{ error: any }> {
    if (isMockMode) {
      const blocks = mockDb.getBlocks();
      const filtered = blocks.filter(b => !(b.blocker_id === blockerId && b.blocked_id === blockedId));
      mockDb.saveBlocks(filtered);
      window.dispatchEvent(new CustomEvent("kb_blocks_updated"));
      return { error: null };
    } else {
      const { error } = await supabase
        .from("blocks")
        .delete()
        .eq("blocker_id", blockerId)
        .eq("blocked_id", blockedId);

      return { error };
    }
  }
}

export const blockService = new BlockServiceClass();
export default blockService;
